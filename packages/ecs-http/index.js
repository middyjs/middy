// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import cluster from "node:cluster";
import http from "node:http";
import { availableParallelism } from "node:os";
import { validateOptions } from "@middy/util";

const name = "ecs-http";
const pkg = `@middy/${name}`;

const defaults = {
	port: 80,
	eventVersion: "2.0",
	requestContext: {},
	timeout: 60_000,
	bodyLimit: 10 * 1024 * 1024,
	trustedProxies: 1,
	// ECS sends SIGKILL stopTimeout (default 30s) after SIGTERM; 5s is left for
	// the primary to see its workers exit and exit itself.
	// https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_timeout
	gracefulShutdownMs: 25_000,
};

const optionSchema = {
	type: "object",
	properties: {
		handler: { instanceof: "Function" },
		port: { type: "integer", minimum: 0, maximum: 65535 },
		eventVersion: { type: "string", enum: ["1.0", "2.0", "alb"] },
		requestContext: { type: "object", additionalProperties: true },
		workers: { type: "integer", minimum: 1 },
		timeout: { type: "integer", minimum: 0 },
		bodyLimit: { type: "integer", minimum: 0 },
		trustedProxies: { type: "integer", minimum: 0 },
		gracefulShutdownMs: { type: "integer", minimum: 0 },
		contextOverride: {
			type: "object",
			properties: {
				awsRequestId: { instanceof: "Function" },
			},
			additionalProperties: false,
		},
	},
	required: ["handler"],
	additionalProperties: false,
};

export const ecsHttpValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const ecsEnvKeys = ["accountId", "region", "taskArn", "family", "revision"];
const ecsEnvPrefix = "MIDDY_ECS_";

export const fetchEcsMetadata = async (
	uri = process.env.ECS_CONTAINER_METADATA_URI_V4,
	fetchImpl = fetch,
) => {
	if (!uri) return {};
	try {
		const res = await fetchImpl(`${uri}/task`);
		if (!res.ok) return {};
		const task = await res.json();
		const arn = task.TaskARN ?? "";
		const arnParts = arn.split(":");
		return {
			accountId: arnParts[4],
			region: arnParts[3],
			taskArn: arn || undefined,
			family: task.Family,
			revision:
				task.Revision !== undefined && task.Revision !== null
					? String(task.Revision)
					: undefined,
		};
	} catch {
		return {};
	}
};

const writeEcsEnv = (meta, env = process.env) => {
	for (const key of ecsEnvKeys) {
		if (meta[key] !== undefined && meta[key] !== null)
			env[`${ecsEnvPrefix}${key.toUpperCase()}`] = meta[key];
	}
};

export const readEcsEnv = (env = process.env) => {
	const out = {};
	for (const key of ecsEnvKeys) {
		const v = env[`${ecsEnvPrefix}${key.toUpperCase()}`];
		if (v !== undefined && v !== null) out[key] = v;
	}
	return out;
};

const composeInvokedFunctionArn = (ecs) => {
	if (!ecs.region || !ecs.accountId || !ecs.family) return undefined;
	return `arn:aws:ecs:${ecs.region}:${ecs.accountId}:service/${ecs.family}`;
};

// The optional `<name>+` prefix covers bare `json`/`xml` as well as every
// structured-syntax suffix form (`ld+json`, `vnd.api+json`, `soap+xml`).
const textContentTypePattern =
	/^(text\/|application\/(x-www-form-urlencoded|javascript|graphql|([a-z0-9.+-]+\+)?(json|xml)))/i;

const isTextContentType = (contentType) => {
	if (!contentType) return true;
	return textContentTypePattern.test(contentType);
};

export const lowercaseHeaders = (rawHeaders) => {
	const headers = {};
	// `for...in` for the same reason as buildMultiValueHeaders below.
	for (const k in rawHeaders) {
		const v = rawHeaders[k];
		headers[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : v;
	}
	return headers;
};

const buildMultiValueHeaders = (rawHeaders) => {
	const out = {};
	// `for...in` avoids the `[k, v]` tuple array allocation that
	// `Object.entries` does. Header names from req.headers are already
	// lowercased by node:http; skip the redundant .toLowerCase() too.
	for (const k in rawHeaders) {
		const v = rawHeaders[k];
		out[k] = Array.isArray(v) ? v : [v];
	}
	return out;
};

// With routing.http.xff_client_port.enabled ALB appends "ip:port" for IPv4
// and "[ip]:port" for IPv6; a bare IPv6 hop has no brackets. The event
// carries the address only.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
const ipv6WithPort = /^\[([^\]]+)\]:\d+$/;
const ipv4WithPort = /^([^:]+):\d+$/;
const stripClientPort = (hop) => {
	const match = ipv6WithPort.exec(hop) ?? ipv4WithPort.exec(hop);
	return match ? match[1] : hop;
};

// Behind ALB the client address is the hop the load balancer appends, i.e. the
// last one. Anything before it arrived in the client's own request and can be
// spoofed. `trustedProxies` is the number of trailing hops added by proxies
// you control (1 for a lone ALB, 2 for CloudFront in front of ALB). 0 ignores
// the header and uses the socket address.
export const resolveSourceIp = (headers, socketAddress, trustedProxies = 1) => {
	if (trustedProxies > 0) {
		const xff = headers["x-forwarded-for"];
		if (xff) {
			const hop = xff.split(",").at(-trustedProxies)?.trim();
			if (hop) return stripClientPort(hop);
		}
	}
	return socketAddress ?? "";
};

// Behind ALB / API Gateway, every request carries `X-Amzn-Trace-Id`. We use it
// as the request ID for free correlation with X-Ray and CloudWatch logs.
// When absent (typically only in local dev or behind a non-AWS load balancer),
export const resolveRequestId = (headers, override) =>
	headers["x-amzn-trace-id"] ?? override?.(headers) ?? "";

const parseCookies = (cookieHeader) => {
	if (!cookieHeader) return undefined;
	return cookieHeader
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean);
};

// Cheap path/query split. node:http has already validated the request line by
// the time req.url reaches us, any URL we receive is guaranteed parsable, so
// we skip the (~150 ns) `new URL(...)` validation step entirely.
const splitUrl = (rawUrl) => {
	const qIdx = rawUrl.indexOf("?");
	if (qIdx < 0) return { path: rawUrl, queryString: "" };
	return {
		path: rawUrl.slice(0, qIdx),
		queryString: rawUrl.slice(qIdx + 1),
	};
};

// Only v1 carries multiValueQueryStringParameters; v2 would otherwise
// allocate the multi-value map on every request and discard it. Format 2.0
// combines duplicate query strings with commas instead.
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
const collectQuery = (queryString) => {
	const single = Object.create(null);
	const params = new URLSearchParams(queryString);
	let size = 0;
	for (const [k, v] of params.entries()) {
		single[k] = k in single ? `${single[k]},${v}` : v;
		size++;
	}
	return { single, size };
};

// ALB splits the query string on `&`/`=` and hands over the raw substrings:
// "If the query parameters are URL-encoded, the load balancer does not decode
// them. You must decode them in your Lambda function."
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
// Decoding here would make an ecs-http handler see different values than the
// same handler behind a real load balancer.
const collectQueryEncoded = (queryString) => {
	const single = Object.create(null);
	for (const pair of queryString.split("&")) {
		if (!pair) continue;
		const eq = pair.indexOf("=");
		// Last value wins, matching ALB's default (non multi-value) format.
		if (eq === -1) single[pair] = "";
		else single[pair.slice(0, eq)] = pair.slice(eq + 1);
	}
	return single;
};

const collectQueryMultiValue = (queryString) => {
	const single = Object.create(null);
	const multi = Object.create(null);
	const params = new URLSearchParams(queryString);
	let size = 0;
	for (const [k, v] of params.entries()) {
		single[k] = v;
		multi[k] ??= [];
		multi[k].push(v);
		size++;
	}
	return { single, multi, size };
};

const protocolFor = (httpVersion) => `HTTP/${httpVersion}`;

const EMPTY_BUFFER = Buffer.alloc(0);

// Event builders accept pre-parsed inputs from the request handler so the
// request hot path doesn't re-parse headers/url for each builder call.
// `headers` MUST already be the per-request headers object (req.headers is
// already lowercased by node:http; only repeated headers may have array values).
// `url` is the result of splitUrl(req.url). `requestStart` is reused as
// `timeEpoch` to skip a redundant Date.now().

const encodeBody = (body, isBase64Encoded) => {
	if (body.length === 0) return undefined;
	return isBase64Encoded ? body.toString("base64") : body.toString("utf-8");
};

export const buildEventV2 = (input) => {
	const { req, body, isBase64Encoded, requestContext, sourceIp, requestId } =
		input;
	const headers = input.headers ?? req.headers;
	const url = input.url ?? splitUrl(req.url);
	const requestStart = input.requestStart ?? Date.now();
	const { single: queryStringParameters, size } = collectQuery(url.queryString);
	return {
		version: "2.0",
		routeKey: "$default",
		rawPath: url.path,
		rawQueryString: url.queryString,
		cookies: parseCookies(headers.cookie),
		headers,
		queryStringParameters: size > 0 ? queryStringParameters : undefined,
		requestContext: {
			...requestContext,
			requestId,
			http: {
				method: req.method,
				path: url.path,
				protocol: protocolFor(req.httpVersion),
				sourceIp,
				userAgent: headers["user-agent"] ?? "",
			},
			timeEpoch: requestStart,
		},
		body: encodeBody(body, isBase64Encoded),
		isBase64Encoded,
	};
};

export const buildEventV1 = (input) => {
	const { req, body, isBase64Encoded, requestContext, sourceIp, requestId } =
		input;
	const headers = input.headers ?? req.headers;
	const url = input.url ?? splitUrl(req.url);
	const {
		single: queryStringParameters,
		multi: multiValueQueryStringParameters,
		size,
	} = collectQueryMultiValue(url.queryString);
	const v1Body = encodeBody(body, isBase64Encoded);
	return {
		resource: url.path,
		path: url.path,
		httpMethod: req.method,
		headers,
		multiValueHeaders: buildMultiValueHeaders(req.headers),
		queryStringParameters: size > 0 ? queryStringParameters : null,
		multiValueQueryStringParameters:
			size > 0 ? multiValueQueryStringParameters : null,
		pathParameters: null,
		stageVariables: null,
		requestContext: {
			...requestContext,
			requestId,
			httpMethod: req.method,
			path: url.path,
			protocol: protocolFor(req.httpVersion),
			identity: { sourceIp, userAgent: headers["user-agent"] ?? null },
		},
		body: v1Body === undefined ? null : v1Body,
		isBase64Encoded,
	};
};

// ALB events carry only requestContext.elb: no identity block, so the client
// address is left to the X-Forwarded-For header like on Lambda.
// https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html
export const buildEventAlb = (input) => {
	const { req, body, isBase64Encoded, requestContext, requestId } = input;
	const headers = input.headers ?? req.headers;
	const url = input.url ?? splitUrl(req.url);
	const queryStringParameters = collectQueryEncoded(url.queryString);
	const albBody = encodeBody(body, isBase64Encoded);
	return {
		requestContext: {
			...requestContext,
			elb: requestContext.elb ?? { targetGroupArn: "" },
			requestId,
		},
		httpMethod: req.method,
		path: url.path,
		queryStringParameters,
		headers,
		body: albBody === undefined ? "" : albBody,
		isBase64Encoded,
	};
};

const eventBuilders = {
	"1.0": buildEventV1,
	"2.0": buildEventV2,
	alb: buildEventAlb,
};

export const buildContext = ({
	timeout,
	requestStart,
	awsRequestId,
	invokedFunctionArn,
}) => ({
	awsRequestId,
	invokedFunctionArn,
	getRemainingTimeInMillis: () =>
		Math.max(0, timeout - (Date.now() - requestStart)),
});

// API Gateway REST (format 1.0) and ALB multi-value responses carry repeated
// headers such as set-cookie in multiValueHeaders. With both maps set, API
// Gateway merges them per header, listing a value found in both only once.
// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
const mergeMultiValueHeaders = (headers, multiValueHeaders) => {
	const keys = new Map(Object.keys(headers).map((k) => [k.toLowerCase(), k]));
	for (const [name, values] of Object.entries(multiValueHeaders)) {
		const key = keys.get(name.toLowerCase()) ?? name;
		const merged = [...values];
		const single = headers[key];
		if (single !== undefined && !merged.includes(single)) merged.push(single);
		headers[key] = merged;
	}
};

export const writeResponse = (res, result) => {
	let statusCode = 200;
	let headers = {};
	let body;
	let isBase64Encoded = false;
	let cookies;

	if (typeof result === "string") {
		body = result;
	} else if (
		result !== null &&
		typeof result === "object" &&
		!("statusCode" in result) &&
		!("body" in result)
	) {
		headers["content-type"] = "application/json";
		body = JSON.stringify(result);
	} else {
		const r = result ?? {};
		statusCode = r.statusCode ?? 200;
		headers = { ...(r.headers ?? {}) };
		if (r.multiValueHeaders) {
			mergeMultiValueHeaders(headers, r.multiValueHeaders);
		}
		body = r.body;
		isBase64Encoded = r.isBase64Encoded ?? false;
		cookies = r.cookies;
	}

	if (Array.isArray(cookies) && cookies.length > 0) {
		headers["set-cookie"] = cookies;
	}
	// Settle the payload before writeHead: anything that throws here still
	// reaches writeError with the headers unsent. res.end only takes a string
	// or bytes, so any other body is sent as JSON.
	let payload;
	if (body === undefined || body === null || body === "") {
		payload = undefined;
	} else if (isBase64Encoded) {
		payload = Buffer.from(body, "base64");
	} else if (typeof body === "string" || body instanceof Uint8Array) {
		payload = body;
	} else {
		payload = JSON.stringify(body);
	}
	res.writeHead(statusCode, headers);
	if (payload === undefined) {
		res.end();
		return;
	}
	res.end(payload);
};

const writeError = (res, err) => {
	// A failure after writeHead cannot become an error response; writeHead
	// would throw ERR_HTTP_HEADERS_SENT out of the request handler. Drop the
	// connection so the client sees the response was cut short.
	if (res.headersSent) {
		res.destroy();
		return;
	}
	const statusCode =
		typeof err?.statusCode === "number" && err.statusCode >= 400
			? err.statusCode
			: 500;
	// Below 500 `err` is an object: that is where the numeric statusCode came from.
	const message =
		statusCode >= 500 ? "Internal Server Error" : (err.message ?? "");
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify({ message }));
};

// Returns true when the request declares a body (Content-Length > 0 or
// chunked Transfer-Encoding). For body-less requests (most GET/HEAD/OPTIONS),
// the request handler skips readBody entirely and uses EMPTY_BUFFER, which
// avoids the Promise + listener registrations + Buffer.concat per request.
const requestHasBody = (headers) => {
	const cl = headers["content-length"];
	if (cl !== undefined && cl !== null && cl !== "0" && cl !== "") return true;
	const te = headers["transfer-encoding"];
	if (te !== undefined && te !== null) return true;
	return false;
};

// An oversize body is answered with a 413 at once, without buffering the
// rest. The connection stays up while node:http reads and discards what the
// client is still sending (bounded by server.requestTimeout): destroying the
// request, or closing the socket with body bytes unread, resets it and the
// client never sees the 413.
// https://www.rfc-editor.org/rfc/rfc9112#section-9.6
const payloadTooLarge = () => {
	const err = new Error("Payload too large");
	err.statusCode = 413;
	return err;
};

const readBody = (req, limit) =>
	new Promise((resolve, reject) => {
		if (Number(req.headers["content-length"]) > limit) {
			return reject(payloadTooLarge());
		}
		const chunks = [];
		let size = 0;
		const onData = (chunk) => {
			size += chunk.length;
			if (size > limit) {
				// Removing the listener stops buffering; the stream keeps flowing.
				// https://nodejs.org/api/stream.html#event-data
				req.removeListener("data", onData);
				reject(payloadTooLarge());
				return;
			}
			chunks.push(chunk);
		};
		req.on("data", onData);
		req.once("end", () => resolve(Buffer.concat(chunks)));
		req.once("error", reject);
	});

export const createRequestHandler = ({
	handler,
	eventVersion,
	requestContext,
	timeout,
	bodyLimit,
	trustedProxies,
	invokedFunctionArn,
	contextOverride,
	isDraining = () => false,
}) => {
	const buildEvent = eventBuilders[eventVersion];
	const requestIdOverride = contextOverride?.awsRequestId;
	// server.close() only closes idle connections; one busy when draining
	// starts would otherwise keep serving requests on its keep-alive socket.
	// Without keep-alive node:http sends `Connection: close` and closes the
	// socket once the response is written.
	const closeIfDraining = (res) => {
		if (isDraining()) res.shouldKeepAlive = false;
	};
	return async (req, res) => {
		const requestStart = Date.now();
		try {
			// node:http already lowercases header keys, so use req.headers directly
			// in the hot path and skip the redundant copy.
			const headers = req.headers;
			const hasBody = requestHasBody(headers);
			const body = hasBody ? await readBody(req, bodyLimit) : EMPTY_BUFFER;
			const isBase64Encoded =
				hasBody && !isTextContentType(headers["content-type"]);
			const sourceIp = resolveSourceIp(
				headers,
				req.socket?.remoteAddress,
				trustedProxies,
			);
			const requestId = resolveRequestId(headers, requestIdOverride);
			const url = splitUrl(req.url);
			const event = buildEvent({
				req,
				headers,
				url,
				body,
				isBase64Encoded,
				requestContext,
				sourceIp,
				requestId,
				requestStart,
			});
			const context = buildContext({
				timeout,
				requestStart,
				awsRequestId: requestId,
				invokedFunctionArn,
			});
			const result = await handler(event, context);
			closeIfDraining(res);
			writeResponse(res, result);
		} catch (err) {
			closeIfDraining(res);
			writeError(res, err);
		}
	};
};

// server.close() stops new connections and closes idle ones; busy ones close
// after their response (see closeIfDraining). A connection still open at the
// deadline (a slow request, or one that never sent a request, which node:http
// does not count as idle) is cut so the worker exits before ECS's SIGKILL.
// https://nodejs.org/api/http.html#serverclosecallback
export const drainAndExit = (
	server,
	exitImpl = process.exit,
	gracefulShutdownMs = defaults.gracefulShutdownMs,
) =>
	new Promise((resolve) => {
		const deadline = setTimeout(() => {
			server.closeAllConnections();
			exitImpl(1);
			resolve();
		}, gracefulShutdownMs);
		server.close(() => {
			clearTimeout(deadline);
			exitImpl(0);
			resolve();
		});
	});

export const runWorker = async (options, deps = {}) => {
	const httpImpl = deps.http ?? http;
	const exitImpl = deps.exit ?? process.exit;
	const ecs = readEcsEnv();
	const requestContext = { ...ecs, ...options.requestContext };
	const invokedFunctionArn = composeInvokedFunctionArn(ecs);
	let draining = false;
	const requestHandler = createRequestHandler({
		handler: options.handler,
		eventVersion: options.eventVersion,
		requestContext,
		timeout: options.timeout,
		bodyLimit: options.bodyLimit,
		trustedProxies: options.trustedProxies,
		invokedFunctionArn,
		contextOverride: options.contextOverride,
		isDraining: () => draining,
	});
	const server = httpImpl.createServer(requestHandler);
	// Tune keep-alive so behind-ALB sockets aren't recycled prematurely. ALB's
	// default idle timeout is 60s; the server's keepAliveTimeout must be
	// strictly greater (Node default is 5s, which thrashes connections under
	// real ALB traffic). headersTimeout must in turn exceed keepAliveTimeout.
	server.keepAliveTimeout = 65_000;
	server.headersTimeout = 70_000;
	// Align node:http's per-request hard timeout with the package's `timeout`
	// option (default 60s). The Node default of 300s diverges from the
	// `getRemainingTimeInMillis` budget we expose to handlers.
	server.requestTimeout = options.timeout;
	await new Promise((resolve) => server.listen(options.port, resolve));
	const onSigterm = () => {
		draining = true;
		return drainAndExit(server, exitImpl, options.gracefulShutdownMs);
	};
	process.once("SIGTERM", onSigterm);
	return { server, onSigterm };
};

// Crash-loop guard for worker re-forks. Each worker exit within `healthyMs` of
// the previous one doubles the delay before the replacement is forked, from
// 1 s up to a 30 s cap; 60 s without any exit starts over at 1 s.
const reforkBackoff = { initialMs: 1_000, maxMs: 30_000, healthyMs: 60_000 };

export const runPrimary = async (options, deps = {}) => {
	const clusterImpl = deps.cluster ?? cluster;
	const fetchImpl = deps.fetch ?? fetch;
	const exitImpl = deps.exit ?? process.exit;
	const setTimeoutImpl = deps.setTimeout ?? setTimeout;
	const meta = await fetchEcsMetadata(
		process.env.ECS_CONTAINER_METADATA_URI_V4,
		fetchImpl,
	);
	writeEcsEnv(meta);
	let stopping = false;
	let delayMs = 0;
	let lastExitAt = -Infinity;
	// Highest exit code a worker reported while draining, so a worker that died
	// non-zero during shutdown surfaces as a non-zero task exit instead of 0. A
	// crash before SIGTERM is re-forked and does not count: the worker was
	// replaced and the task went on serving.
	let workerExitCode = 0;
	const liveWorkers = () => Object.values(clusterImpl.workers ?? {});
	const exitWhenDrained = () => {
		if (liveWorkers().length === 0) exitImpl(workerExitCode);
	};
	const nextReforkDelay = () => {
		const now = Date.now();
		delayMs =
			now - lastExitAt >= reforkBackoff.healthyMs
				? reforkBackoff.initialMs
				: Math.min(delayMs * 2, reforkBackoff.maxMs);
		lastExitAt = now;
		return delayMs;
	};
	for (let i = 0; i < options.workers; i++) clusterImpl.fork();
	clusterImpl.on("exit", (_worker, code) => {
		if (stopping) {
			// code is null when a signal killed the worker; that is not a clean exit.
			workerExitCode = Math.max(workerExitCode, code ?? 1);
			return exitWhenDrained();
		}
		setTimeoutImpl(() => {
			if (!stopping) clusterImpl.fork();
		}, nextReforkDelay());
	});
	// node:cluster drops a worker from cluster.workers before the last of its
	// exit/disconnect events, in either order, so the drain check runs on both.
	clusterImpl.on("disconnect", () => {
		if (stopping) exitWhenDrained();
	});
	const onSigterm = () => {
		stopping = true;
		for (const w of liveWorkers()) w?.process.kill("SIGTERM");
		exitWhenDrained();
	};
	process.once("SIGTERM", onSigterm);
	return { onSigterm };
};

export const ecsHttpRunner = async (opts, deps = {}) => {
	const clusterImpl = deps.cluster ?? cluster;
	const options = { ...defaults, workers: availableParallelism(), ...opts };
	ecsHttpValidateOptions(options);
	if (clusterImpl.isPrimary) {
		return runPrimary(options, deps);
	}
	return runWorker(options, deps);
};

export default ecsHttpRunner;
