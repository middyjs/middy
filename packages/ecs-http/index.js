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
			revision: task.Revision != null ? String(task.Revision) : undefined,
		};
	} catch {
		return {};
	}
};

const writeEcsEnv = (meta, env = process.env) => {
	for (const key of ecsEnvKeys) {
		if (meta[key] != null)
			env[`${ecsEnvPrefix}${key.toUpperCase()}`] = meta[key];
	}
};

export const readEcsEnv = (env = process.env) => {
	const out = {};
	for (const key of ecsEnvKeys) {
		const v = env[`${ecsEnvPrefix}${key.toUpperCase()}`];
		if (v != null) out[key] = v;
	}
	return out;
};

const composeInvokedFunctionArn = (ecs) => {
	if (!ecs.region || !ecs.accountId || !ecs.family) return undefined;
	return `arn:aws:ecs:${ecs.region}:${ecs.accountId}:service/${ecs.family}`;
};

// Stryker disable Regex: this block disable silences every Regex mutant of the pattern below, because Stryker cannot scope a Regex disable to one mutant. The mutant that is equivalent makes the `([a-z0-9.+-]+\+)?` group mandatory: the bare `json|xml` alternatives earlier in the same group already accept every subtype the optional form would, and only match/no-match is observed. The content-type table test exercises the anchor (`multipart/related; type=text/html`) and the `.` and `+` class members (`application/vnd.api+json`), but with the disable in place those kills are not observed by Stryker.
const textContentTypePattern =
	/^(text\/|application\/(json|xml|x-www-form-urlencoded|javascript|graphql|ld\+json|vnd\.api\+json|([a-z0-9.+-]+\+)?(json|xml)))/i;
// Stryker restore Regex

const isTextContentType = (contentType) => {
	if (!contentType) return true;
	// Fast paths for the ~95% of real traffic. Avoids regex when possible.
	// Stryker disable next-line ConditionalExpression,StringLiteral: pure fast path; skipping it (or comparing against "", which `!contentType` already returned on) sends the value to the regex below, which accepts "application/json" too.
	if (contentType === "application/json") return true;
	// Stryker disable next-line ConditionalExpression: pure fast path; the regex below also accepts every "text/" prefix.
	if (contentType.startsWith("text/")) return true;
	// Stryker disable next-line ConditionalExpression: pure fast path; the regex below also accepts every "application/json;" prefix.
	if (contentType.startsWith("application/json;")) return true;
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
// allocate the multi-value map on every request and discard it.
const collectQuery = (queryString) => {
	const single = Object.create(null);
	// Stryker disable next-line ConditionalExpression: pure fast path; new URLSearchParams("") iterates nothing, so falling through yields the same empty map and size 0.
	if (!queryString) return { single, size: 0 };
	const params = new URLSearchParams(queryString);
	let size = 0;
	for (const [k, v] of params.entries()) {
		single[k] = v;
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
	// Stryker disable next-line ConditionalExpression: pure fast path; "".split("&") yields [""], which the empty-pair guard below skips, so falling through yields the same empty map.
	if (!queryString) return single;
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
	// Stryker disable next-line ConditionalExpression,ObjectLiteral: pure fast path; new URLSearchParams("") iterates nothing, so falling through yields the same empty maps and size 0, and the only consumer (buildEventV1) emits null for both maps whenever size is not > 0, so returning {} is indistinguishable too.
	if (!queryString) return { single, multi, size: 0 };
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

// Pre-cached protocol strings. ~99.9% of requests are HTTP/1.1; fall back to
// concat only for anything else.
// Stryker disable ObjectLiteral: emptying the cache is equivalent; every lookup then falls through to the `HTTP/${httpVersion}` concat, which produces the same strings. (The per-entry StringLiteral mutants are killed by the protocol table test.)
const PROTOCOLS = {
	1.1: "HTTP/1.1",
	"1.0": "HTTP/1.0",
	"2.0": "HTTP/2.0",
};
// Stryker restore ObjectLiteral
const protocolFor = (httpVersion) =>
	PROTOCOLS[httpVersion] ?? `HTTP/${httpVersion}`;

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
		body = r.body;
		isBase64Encoded = r.isBase64Encoded ?? false;
		cookies = r.cookies;
	}

	if (Array.isArray(cookies) && cookies.length > 0) {
		headers["set-cookie"] = cookies;
	}
	res.writeHead(statusCode, headers);
	if (body == null || body === "") {
		res.end();
		return;
	}
	if (isBase64Encoded) {
		res.end(Buffer.from(body, "base64"));
		return;
	}
	res.end(body);
};

const writeError = (res, err) => {
	const statusCode =
		typeof err?.statusCode === "number" && err.statusCode >= 400
			? err.statusCode
			: 500;
	// Stryker disable OptionalChaining: equivalent; the `err?.message` branch only runs when statusCode < 500, which requires err to be an object carrying a numeric statusCode, so err is never nullish there.
	const message =
		statusCode >= 500 ? "Internal Server Error" : (err?.message ?? "");
	// Stryker restore OptionalChaining
	res.writeHead(statusCode, { "content-type": "application/json" });
	res.end(JSON.stringify({ message }));
};

// Returns true when the request declares a body (Content-Length > 0 or
// chunked Transfer-Encoding). For body-less requests (most GET/HEAD/OPTIONS),
// the request handler skips readBody entirely and uses EMPTY_BUFFER, which
// avoids the Promise + listener registrations + Buffer.concat per request.
const requestHasBody = (headers) => {
	const cl = headers["content-length"];
	if (cl != null && cl !== "0" && cl !== "") return true;
	if (headers["transfer-encoding"] != null) return true;
	return false;
};

const readBody = (req, limit) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > limit) {
				const err = new Error("Payload too large");
				err.statusCode = 413;
				req.destroy();
				reject(err);
				return;
			}
			chunks.push(chunk);
		});
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
}) => {
	const buildEvent = eventBuilders[eventVersion];
	const requestIdOverride = contextOverride?.awsRequestId;
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
			writeResponse(res, result);
		} catch (err) {
			writeError(res, err);
		}
	};
};

export const drainAndExit = (server, exitImpl = process.exit) =>
	new Promise((resolve) => {
		server.close(() => {
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
	const requestHandler = createRequestHandler({
		handler: options.handler,
		eventVersion: options.eventVersion,
		requestContext,
		timeout: options.timeout,
		bodyLimit: options.bodyLimit,
		trustedProxies: options.trustedProxies,
		invokedFunctionArn,
		contextOverride: options.contextOverride,
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
	const onSigterm = () => drainAndExit(server, exitImpl);
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
