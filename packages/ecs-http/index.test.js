// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import nodeCluster from "node:cluster";
import { EventEmitter } from "node:events";
import http from "node:http";
import { describe, mock, test } from "node:test";
import {
	buildContext,
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	createRequestHandler,
	drainAndExit,
	ecsHttpRunner,
	ecsHttpValidateOptions,
	fetchEcsMetadata,
	lowercaseHeaders,
	readEcsEnv,
	resolveRequestId,
	resolveSourceIp,
	runPrimary,
	runWorker,
	writeResponse,
} from "./index.js";

// Guard: nothing in this suite may fork real workers. Under mutation testing a
// mutant that drops the injected fake cluster once spawned ~10k processes.
mock.method(nodeCluster, "fork", () => {
	throw new Error("real cluster.fork called in tests");
});
// Guard: nothing in this suite may end the process. A mutant that swaps an
// injected `exit` for the real one would otherwise call process.exit(0) from a
// test and turn every later failure into a green run.
mock.method(process, "exit", () => {
	throw new Error("real process.exit called in tests");
});

const noop = () => {};

// Fake node:http request: a plain EventEmitter so body chunks, "end" and
// "error" can be driven by hand without a socket.
const makeReq = ({
	method = "GET",
	url = "/",
	headers = {},
	httpVersion = "1.1",
	socket = { remoteAddress: "127.0.0.1" },
} = {}) => {
	const req = new EventEmitter();
	Object.assign(req, { method, url, headers, httpVersion, socket });
	req.destroyed = false;
	req.destroy = () => {
		req.destroyed = true;
	};
	return req;
};

// Query maps are null-prototype objects; deepStrictEqual compares prototypes.
const nullProto = (o) => Object.assign(Object.create(null), o);

const startServer = async (handler) => {
	const server = http.createServer(handler);
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	const { port } = server.address();
	return {
		server,
		url: `http://127.0.0.1:${port}`,
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections?.();
				server.close(() => resolve());
			}),
	};
};

// --- ecsHttpValidateOptions -------------------------------------------------

describe("@middy/ecs-http", () => {
	test("ecsHttpValidateOptions accepts a valid config", () => {
		ecsHttpValidateOptions({
			handler: noop,
			port: 8080,
			eventVersion: "2.0",
			requestContext: {},
			workers: 2,
			timeout: 1000,
			bodyLimit: 1024,
		});
	});

	test("ecsHttpValidateOptions requires handler", () => {
		throws(() => ecsHttpValidateOptions({}), TypeError);
	});

	test("ecsHttpValidateOptions rejects unknown eventVersion", () => {
		throws(
			() => ecsHttpValidateOptions({ handler: noop, eventVersion: "3.0" }),
			TypeError,
		);
	});

	test("ecsHttpValidateOptions accepts trustedProxies 0", () => {
		ecsHttpValidateOptions({ handler: noop, trustedProxies: 0 });
	});

	test("ecsHttpValidateOptions rejects negative trustedProxies", () => {
		throws(
			() => ecsHttpValidateOptions({ handler: noop, trustedProxies: -1 }),
			TypeError,
		);
	});

	test("ecsHttpValidateOptions rejects non-integer trustedProxies", () => {
		throws(
			() => ecsHttpValidateOptions({ handler: noop, trustedProxies: 1.5 }),
			TypeError,
		);
	});

	test("ecsHttpValidateOptions rejects unknown property", () => {
		throws(
			() => ecsHttpValidateOptions({ handler: noop, foo: "bar" }),
			TypeError,
		);
	});

	test("ecsHttpValidateOptions names the package in the error cause", () => {
		throws(() => ecsHttpValidateOptions({}), {
			name: "TypeError",
			message: "Missing required option 'handler'",
			cause: { package: "@middy/ecs-http" },
		});
	});

	test("ecsHttpValidateOptions accepts every documented eventVersion", () => {
		for (const eventVersion of ["1.0", "2.0", "alb"]) {
			ecsHttpValidateOptions({ handler: noop, eventVersion });
		}
	});

	test("ecsHttpValidateOptions accepts arbitrary requestContext fields", () => {
		ecsHttpValidateOptions({
			handler: noop,
			requestContext: { elb: { targetGroupArn: "arn:tg" }, stage: "prod" },
		});
	});

	test("ecsHttpValidateOptions accepts contextOverride.awsRequestId function", () => {
		ecsHttpValidateOptions({
			handler: noop,
			contextOverride: { awsRequestId: () => "id" },
		});
	});

	test("ecsHttpValidateOptions rejects non-function contextOverride.awsRequestId", () => {
		throws(
			() =>
				ecsHttpValidateOptions({
					handler: noop,
					contextOverride: { awsRequestId: "id" },
				}),
			{
				name: "TypeError",
				message:
					"Option 'contextOverride.awsRequestId' must be instanceof Function",
			},
		);
	});

	test("ecsHttpValidateOptions rejects unknown contextOverride keys", () => {
		throws(
			() =>
				ecsHttpValidateOptions({
					handler: noop,
					contextOverride: { awsRequestId: () => "id", foo: 1 },
				}),
			{ name: "TypeError", message: "Unknown option 'contextOverride.foo'" },
		);
	});

	// --- helpers ----------------------------------------------------------------

	test("lowercaseHeaders lowercases keys and joins arrays", () => {
		deepStrictEqual(
			lowercaseHeaders({ "Content-Type": "text/plain", "X-A": ["1", "2"] }),
			{ "content-type": "text/plain", "x-a": "1,2" },
		);
	});

	test("resolveSourceIp takes the last X-Forwarded-For hop by default", () => {
		// ALB appends the connecting client's address as the final hop; earlier
		// hops are whatever the client sent and cannot be trusted.
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }, "127.0.0.1"),
			"10.0.0.1",
		);
	});

	test("resolveSourceIp ignores a client-supplied hop prepended before the ALB hop", () => {
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "6.6.6.6, 203.0.113.9" },
				"127.0.0.1",
			),
			"203.0.113.9",
		);
	});

	test("resolveSourceIp takes the single hop when only the ALB appended one", () => {
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": "203.0.113.9" }, "127.0.0.1"),
			"203.0.113.9",
		);
	});

	test("resolveSourceIp with trustedProxies 2 takes the second-to-last hop", () => {
		// e.g. CloudFront appends the client, then ALB appends CloudFront.
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 130.176.0.1" },
				"127.0.0.1",
				2,
			),
			"203.0.113.9",
		);
	});

	test("resolveSourceIp with trustedProxies 0 ignores X-Forwarded-For", () => {
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": "6.6.6.6" }, "127.0.0.1", 0),
			"127.0.0.1",
		);
	});

	test("resolveSourceIp falls back to socket when fewer hops than trustedProxies", () => {
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": "203.0.113.9" }, "127.0.0.1", 2),
			"127.0.0.1",
		);
	});

	test("resolveSourceIp trims whitespace around the selected hop", () => {
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "6.6.6.6 , 203.0.113.9 " },
				"127.0.0.1",
			),
			"203.0.113.9",
		);
	});

	test("resolveSourceIp falls back to socket when the selected hop is empty", () => {
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": "6.6.6.6," }, "127.0.0.1"),
			"127.0.0.1",
		);
	});

	test("resolveSourceIp falls back to socket address", () => {
		strictEqual(resolveSourceIp({}, "127.0.0.1"), "127.0.0.1");
	});

	test("resolveSourceIp returns empty when nothing available", () => {
		strictEqual(resolveSourceIp({}, undefined), "");
	});

	test("resolveSourceIp falls back to socket when XFF is empty", () => {
		strictEqual(
			resolveSourceIp({ "x-forwarded-for": " " }, "10.0.0.1"),
			"10.0.0.1",
		);
	});

	// With routing.http.xff_client_port.enabled ALB appends "ip:port" for IPv4
	// and "[ip]:port" for IPv6; the event carries the address only.
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
	test("resolveSourceIp strips the client port ALB appends to an IPv4 hop", () => {
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "6.6.6.6, 12.34.56.78:8080" },
				"127.0.0.1",
			),
			"12.34.56.78",
		);
	});

	test("resolveSourceIp strips the brackets and client port from an IPv6 hop", () => {
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "[2001:db8:85a3:8d3:1319:8a2e:370:7348]:8080" },
				"127.0.0.1",
			),
			"2001:db8:85a3:8d3:1319:8a2e:370:7348",
		);
	});

	test("resolveSourceIp keeps a bare IPv6 hop intact", () => {
		strictEqual(
			resolveSourceIp(
				{ "x-forwarded-for": "2001:DB8::21f:5bff:febf:ce22:8a2e" },
				"127.0.0.1",
			),
			"2001:DB8::21f:5bff:febf:ce22:8a2e",
		);
	});

	test("resolveSourceIp keeps bare IPv6 hops with all-digit hextets intact", () => {
		// Digit-only hextets look like "host:port" to a sloppy matcher; the
		// port strip must only fire on a whole "ip:port" / "[ip]:port" hop.
		for (const hop of [
			"2001:4860:4860::8888",
			"2001:db8:85a3::8a2e:370:7348",
			"2001:db8:85a3:0:0:8a2e:370:7348",
		]) {
			strictEqual(
				resolveSourceIp({ "x-forwarded-for": hop }, "127.0.0.1"),
				hop,
			);
		}
	});

	test("resolveSourceIp passes a malformed hop through verbatim", () => {
		// A hop that is not exactly "ip:port" or "[ip]:port" is never rewritten;
		// synthesising an address from a garbage hop would let a client-controlled
		// entry masquerade as a clean IP once trustedProxies overshoots.
		for (const hop of [
			"x[2001:db8::1]:8080",
			"[2001:db8::1]:8080x",
			"x:1.2.3.4:8080",
			"1.2.3.4:8080x",
		]) {
			strictEqual(
				resolveSourceIp({ "x-forwarded-for": hop }, "127.0.0.1"),
				hop,
			);
		}
	});

	test("resolveRequestId honors X-Amzn-Trace-Id", () => {
		strictEqual(
			resolveRequestId({ "x-amzn-trace-id": "Root=1-abc" }),
			"Root=1-abc",
		);
	});

	test("resolveRequestId returns empty string when no trace header and no override", () => {
		strictEqual(resolveRequestId({}), "");
	});

	test("resolveRequestId calls override when no trace header", () => {
		strictEqual(
			resolveRequestId({}, () => "custom-id"),
			"custom-id",
		);
	});

	test("resolveRequestId prefers trace header over override", () => {
		strictEqual(
			resolveRequestId({ "x-amzn-trace-id": "Root=1-abc" }, () => "custom-id"),
			"Root=1-abc",
		);
	});

	test("buildContext exposes Lambda-shaped fields", () => {
		const ctx = buildContext({
			timeout: 1000,
			requestStart: Date.now(),
			awsRequestId: "abc",
			invokedFunctionArn: "arn",
		});
		strictEqual(ctx.awsRequestId, "abc");
		strictEqual(ctx.invokedFunctionArn, "arn");
		ok(ctx.getRemainingTimeInMillis() > 900);
	});

	test("buildContext clamps remaining time to zero", async () => {
		const ctx = buildContext({
			timeout: 1,
			requestStart: Date.now() - 1000,
			awsRequestId: "x",
			invokedFunctionArn: undefined,
		});
		strictEqual(ctx.getRemainingTimeInMillis(), 0);
	});

	// --- event builders ---------------------------------------------------------

	test("buildEventV2 produces a v2 event", () => {
		const headers = { host: "h", "user-agent": "ua/1", cookie: "x=1; y=2" };
		const event = buildEventV2({
			req: makeReq({ method: "POST", url: "/users?a=1&b=2", headers }),
			body: Buffer.from("hello"),
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "9.9.9.9",
			requestId: "rid-1",
			requestStart: 1_700_000_000_000,
		});
		deepStrictEqual(event, {
			version: "2.0",
			routeKey: "$default",
			rawPath: "/users",
			rawQueryString: "a=1&b=2",
			cookies: ["x=1", "y=2"],
			headers,
			queryStringParameters: nullProto({ a: "1", b: "2" }),
			requestContext: {
				accountId: "111",
				requestId: "rid-1",
				http: {
					method: "POST",
					path: "/users",
					protocol: "HTTP/1.1",
					sourceIp: "9.9.9.9",
					userAgent: "ua/1",
				},
				timeEpoch: 1_700_000_000_000,
			},
			body: "hello",
			isBase64Encoded: false,
		});
	});

	test("buildEventV2 minimal request: empty fields, timeEpoch from the clock", (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 5_000 });
		const headers = { host: "h" };
		const event = buildEventV2({
			req: makeReq({ headers }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		deepStrictEqual(event, {
			version: "2.0",
			routeKey: "$default",
			rawPath: "/",
			rawQueryString: "",
			cookies: undefined,
			headers,
			queryStringParameters: undefined,
			requestContext: {
				requestId: "r",
				http: {
					method: "GET",
					path: "/",
					protocol: "HTTP/1.1",
					sourceIp: "",
					userAgent: "",
				},
				timeEpoch: 5_000,
			},
			body: undefined,
			isBase64Encoded: false,
		});
	});

	test("buildEventV2 uses pre-split url and headers from the request handler", () => {
		// The hot path passes its own parsed inputs; the builder must not re-read
		// req.url / req.headers when they are supplied.
		const headers = { host: "h" };
		const event = buildEventV2({
			req: makeReq({ url: "/ignored?z=1", headers: { host: "other" } }),
			headers,
			url: { path: "/given", queryString: "a=1" },
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
			requestStart: 7,
		});
		strictEqual(event.rawPath, "/given");
		strictEqual(event.rawQueryString, "a=1");
		strictEqual(event.headers, headers);
		strictEqual(event.requestContext.timeEpoch, 7);
	});

	test("buildEventV2 reports the request protocol for every cached HTTP version", () => {
		for (const [httpVersion, protocol] of [
			["1.0", "HTTP/1.0"],
			["1.1", "HTTP/1.1"],
			["2.0", "HTTP/2.0"],
		]) {
			const event = buildEventV2({
				req: makeReq({ httpVersion }),
				body: Buffer.alloc(0),
				isBase64Encoded: false,
				requestContext: {},
				sourceIp: "",
				requestId: "r",
			});
			strictEqual(event.requestContext.http.protocol, protocol);
		}
	});

	test("buildEventV2 drops empty cookie entries", () => {
		const event = buildEventV2({
			req: makeReq({ headers: { cookie: "x=1;; y=2; " } }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		deepStrictEqual(event.cookies, ["x=1", "y=2"]);
	});

	test("buildEventV2 splits a url that is only a query string", () => {
		const event = buildEventV2({
			req: makeReq({ url: "?a=1" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.rawPath, "");
		strictEqual(event.rawQueryString, "a=1");
		deepStrictEqual(event.queryStringParameters, nullProto({ a: "1" }));
	});

	test("buildEventV2 omits body when empty and uses base64 when flagged", () => {
		const empty = buildEventV2({
			req: makeReq(),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(empty.body, undefined);
		strictEqual(empty.cookies, undefined);
		strictEqual(empty.queryStringParameters, undefined);

		const b64 = buildEventV2({
			req: makeReq(),
			body: Buffer.from([0xff, 0x00]),
			isBase64Encoded: true,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(b64.body, "/wA=");
		strictEqual(b64.isBase64Encoded, true);
	});

	test("buildEventV1 produces a v1 event with multi-value fields", () => {
		const headers = { host: "h", "user-agent": "ua/1", "x-a": ["1", "2"] };
		const event = buildEventV1({
			req: makeReq({ method: "GET", url: "/x?a=1&a=2", headers }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "1.1.1.1",
			requestId: "rid",
		});
		deepStrictEqual(event, {
			resource: "/x",
			path: "/x",
			httpMethod: "GET",
			headers,
			multiValueHeaders: {
				host: ["h"],
				"user-agent": ["ua/1"],
				"x-a": ["1", "2"],
			},
			queryStringParameters: nullProto({ a: "2" }),
			multiValueQueryStringParameters: nullProto({ a: ["1", "2"] }),
			pathParameters: null,
			stageVariables: null,
			requestContext: {
				accountId: "111",
				requestId: "rid",
				httpMethod: "GET",
				path: "/x",
				protocol: "HTTP/1.1",
				identity: { sourceIp: "1.1.1.1", userAgent: "ua/1" },
			},
			body: null,
			isBase64Encoded: false,
		});
	});

	test("buildEventV1 emits null query params when none", () => {
		const event = buildEventV1({
			req: makeReq(),
			body: Buffer.from("a"),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.queryStringParameters, null);
		strictEqual(event.multiValueQueryStringParameters, null);
		strictEqual(event.body, "a");
		strictEqual(event.requestContext.identity.userAgent, null);
	});

	test("buildEventV1 base64-encodes binary body", () => {
		const event = buildEventV1({
			req: makeReq(),
			body: Buffer.from([0x00, 0xff]),
			isBase64Encoded: true,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.body, "AP8=");
	});

	test("buildEventAlb produces an ALB event", () => {
		const headers = { host: "h", "user-agent": "elb/1" };
		const event = buildEventAlb({
			req: makeReq({ url: "/health?ok=1", headers }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: { elb: { targetGroupArn: "arn:..." } },
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
		deepStrictEqual(event, {
			requestContext: { elb: { targetGroupArn: "arn:..." }, requestId: "rid" },
			httpMethod: "GET",
			path: "/health",
			queryStringParameters: nullProto({ ok: "1" }),
			headers,
			body: "",
			isBase64Encoded: false,
		});
	});

	// ALB does not URL-decode query parameters before invoking the target, so
	// neither may we: a handler that decodes (as AWS instructs) would otherwise
	// double-decode here but not in production.
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
	test("buildEventAlb leaves query parameters URL-encoded", () => {
		const event = buildEventAlb({
			req: makeReq({
				url: "/?full_name=Alex%2BTaylor&spaced=Alex+Taylor&bare",
			}),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "rid",
		});
		deepStrictEqual(
			event.queryStringParameters,
			nullProto({
				full_name: "Alex%2BTaylor",
				spaced: "Alex+Taylor",
				bare: "",
			}),
		);
	});

	test("buildEventAlb keeps the last value for a repeated key", () => {
		const event = buildEventAlb({
			req: makeReq({ url: "/?myKey=val1&myKey=val2" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "rid",
		});
		deepStrictEqual(event.queryStringParameters, nullProto({ myKey: "val2" }));
	});

	test("buildEventAlb skips empty pairs rather than emitting a blank key", () => {
		const event = buildEventAlb({
			req: makeReq({ url: "/?&a=1&&b=2&" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "rid",
		});
		deepStrictEqual(event.queryStringParameters, nullProto({ a: "1", b: "2" }));
	});

	test("buildEventAlb emits an empty queryStringParameters map when there is no query", () => {
		const event = buildEventAlb({
			req: makeReq({ url: "/health" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		deepStrictEqual(event.queryStringParameters, nullProto({}));
	});

	test("buildEventAlb does not emit requestContext.identity", () => {
		// ALB events carry only requestContext.elb; identity is an API Gateway
		// REST field (@types/aws-lambda ALBEventRequestContext has no identity).
		const event = buildEventAlb({
			req: makeReq({ headers: { "x-forwarded-for": "203.0.113.9" } }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "203.0.113.9",
			requestId: "r",
		});
		ok(!("identity" in event.requestContext));
		deepStrictEqual(Object.keys(event.requestContext), ["elb", "requestId"]);
	});

	test("buildEventAlb defaults elb.targetGroupArn when missing", () => {
		const event = buildEventAlb({
			req: makeReq(),
			body: Buffer.from("z"),
			isBase64Encoded: true,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.requestContext.elb.targetGroupArn, "");
		strictEqual(event.body, "eg==");
	});

	// --- writeResponse ----------------------------------------------------------

	const fakeRes = () => {
		const calls = {
			writeHead: null,
			body: null,
			endArgs: null,
			ended: false,
			destroyed: false,
		};
		return {
			headersSent: false,
			writeHead(code, headers) {
				calls.writeHead = { code, headers };
				this.headersSent = true;
			},
			end(...args) {
				calls.endArgs = args;
				calls.body = args[0];
				calls.ended = true;
			},
			destroy() {
				calls.destroyed = true;
			},
			_calls: calls,
		};
	};

	test("writeResponse handles plain string", () => {
		const res = fakeRes();
		writeResponse(res, "hi");
		strictEqual(res._calls.writeHead.code, 200);
		strictEqual(res._calls.body, "hi");
	});

	test("writeResponse JSON-stringifies plain object without statusCode/body", () => {
		const res = fakeRes();
		writeResponse(res, { ok: true });
		strictEqual(
			res._calls.writeHead.headers["content-type"],
			"application/json",
		);
		strictEqual(res._calls.body, '{"ok":true}');
	});

	test("writeResponse honors {statusCode, headers, body}", () => {
		const res = fakeRes();
		writeResponse(res, {
			statusCode: 201,
			headers: { "x-trace": "t" },
			body: "ok",
			cookies: ["a=1", "b=2"],
		});
		strictEqual(res._calls.writeHead.code, 201);
		deepStrictEqual(res._calls.writeHead.headers, {
			"x-trace": "t",
			"set-cookie": ["a=1", "b=2"],
		});
		deepStrictEqual(res._calls.endArgs, ["ok"]);
	});

	test("writeResponse decodes base64 body", () => {
		const res = fakeRes();
		writeResponse(res, {
			statusCode: 200,
			body: Buffer.from("payload").toString("base64"),
			isBase64Encoded: true,
		});
		ok(Buffer.isBuffer(res._calls.body));
		strictEqual(res._calls.body.toString(), "payload");
	});

	test("writeResponse handles null result", () => {
		const res = fakeRes();
		writeResponse(res, null);
		deepStrictEqual(res._calls.writeHead, { code: 200, headers: {} });
		// No body: the response is ended without a chunk argument.
		deepStrictEqual(res._calls.endArgs, []);
	});

	test("writeResponse handles {statusCode} with no body", () => {
		const res = fakeRes();
		writeResponse(res, { statusCode: 204 });
		deepStrictEqual(res._calls.writeHead, { code: 204, headers: {} });
		deepStrictEqual(res._calls.endArgs, []);
	});

	test("writeResponse treats an empty-string body as no body", () => {
		const res = fakeRes();
		writeResponse(res, { statusCode: 200, body: "" });
		deepStrictEqual(res._calls.writeHead, { code: 200, headers: {} });
		deepStrictEqual(res._calls.endArgs, []);
	});

	// --- createRequestHandler integration --------------------------------------

	const startWith = (overrides = {}) =>
		startServer(
			createRequestHandler({
				handler: async (event) => ({
					statusCode: 200,
					body: JSON.stringify(event),
				}),
				eventVersion: "2.0",
				requestContext: { accountId: "111" },
				timeout: 60_000,
				bodyLimit: 1024,
				invokedFunctionArn: "arn:aws:ecs:us-east-1:111:service/my-svc",
				...overrides,
			}),
		);

	test("integration: contextOverride.awsRequestId overrides resolved requestId", async () => {
		let calls = 0;
		const { url, close } = await startWith({
			contextOverride: {
				awsRequestId: () => `custom-${++calls}`,
			},
		});
		const res = await fetch(`${url}/`);
		const body = await res.json();
		strictEqual(body.requestContext.requestId, "custom-1");
		await close();
	});

	test("integration: sourceIp is the last X-Forwarded-For hop by default", async () => {
		const { url, close } = await startWith();
		try {
			const res = await fetch(`${url}/`, {
				headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" },
			});
			const body = await res.json();
			strictEqual(body.requestContext.http.sourceIp, "203.0.113.9");
		} finally {
			await close();
		}
	});

	test("integration: trustedProxies 0 uses the socket address", async () => {
		const { url, close } = await startWith({ trustedProxies: 0 });
		try {
			const res = await fetch(`${url}/`, {
				headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" },
			});
			const body = await res.json();
			strictEqual(body.requestContext.http.sourceIp, "127.0.0.1");
		} finally {
			await close();
		}
	});

	test("integration: trustedProxies 2 skips the trailing proxy hop", async () => {
		const { url, close } = await startWith({ trustedProxies: 2 });
		try {
			const res = await fetch(`${url}/`, {
				headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9, 130.176.0.1" },
			});
			const body = await res.json();
			strictEqual(body.requestContext.http.sourceIp, "203.0.113.9");
		} finally {
			await close();
		}
	});

	test("integration: GET v2 returns event with merged requestContext", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/path?q=1`, {
			headers: { "x-amzn-trace-id": "Root=1-abc" },
		});
		const body = await res.json();
		strictEqual(res.status, 200);
		strictEqual(body.version, "2.0");
		strictEqual(body.rawPath, "/path");
		strictEqual(body.rawQueryString, "q=1");
		strictEqual(body.requestContext.accountId, "111");
		strictEqual(body.requestContext.requestId, "Root=1-abc");
		await close();
	});

	test("integration: POST text body passes through utf-8", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/p`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: '{"a":1}',
		});
		const body = await res.json();
		strictEqual(body.body, '{"a":1}');
		strictEqual(body.isBase64Encoded, false);
		await close();
	});

	test("integration: POST binary body is base64-encoded", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/p`, {
			method: "POST",
			headers: { "content-type": "application/octet-stream" },
			body: new Uint8Array([0xff, 0x00, 0xff]),
		});
		const body = await res.json();
		strictEqual(body.isBase64Encoded, true);
		strictEqual(body.body, Buffer.from([0xff, 0x00, 0xff]).toString("base64"));
		await close();
	});

	test("integration: oversize body returns 413", async () => {
		const { url, close } = await startWith({ bodyLimit: 16 });
		const res = await fetch(`${url}/p`, {
			method: "POST",
			body: "x".repeat(1024),
		}).catch((e) => ({ status: 0, error: e }));
		if (res.status !== 0) strictEqual(res.status, 413);
		await close();
	});

	test("integration: handler error with statusCode is honored", async () => {
		const { url, close } = await startWith({
			handler: () => {
				const e = new Error("nope");
				e.statusCode = 418;
				throw e;
			},
		});
		const res = await fetch(`${url}/x`);
		strictEqual(res.status, 418);
		const body = await res.json();
		strictEqual(body.message, "nope");
		await close();
	});

	test("integration: handler error without statusCode returns 500", async () => {
		const { url, close } = await startWith({
			handler: () => {
				throw new Error("boom");
			},
		});
		const res = await fetch(`${url}/x`);
		strictEqual(res.status, 500);
		const body = await res.json();
		strictEqual(body.message, "Internal Server Error");
		await close();
	});

	test("integration: v1 event shape", async () => {
		const { url, close } = await startWith({ eventVersion: "1.0" });
		const res = await fetch(`${url}/v1?a=1`);
		const body = await res.json();
		strictEqual(body.httpMethod, "GET");
		strictEqual(body.path, "/v1");
		deepStrictEqual(body.queryStringParameters, { a: "1" });
		await close();
	});

	test("integration: alb event shape", async () => {
		const { url, close } = await startWith({
			eventVersion: "alb",
			requestContext: { elb: { targetGroupArn: "arn:tg" } },
		});
		const res = await fetch(`${url}/health?ok=1`);
		const body = await res.json();
		strictEqual(body.path, "/health");
		strictEqual(body.requestContext.elb.targetGroupArn, "arn:tg");
		await close();
	});

	test("integration: handler returns plain string", async () => {
		const { url, close } = await startWith({
			handler: () => "hello",
		});
		const res = await fetch(`${url}/`);
		strictEqual(await res.text(), "hello");
		await close();
	});

	test("integration: handler returns plain object", async () => {
		const { url, close } = await startWith({
			handler: () => ({ ok: true }),
		});
		const res = await fetch(`${url}/`);
		deepStrictEqual(await res.json(), { ok: true });
		await close();
	});

	// --- ECS env / metadata ----------------------------------------------------

	test("readEcsEnv reads MIDDY_ECS_* vars", () => {
		const env = {
			MIDDY_ECS_ACCOUNTID: "123",
			MIDDY_ECS_REGION: "us-east-1",
			MIDDY_ECS_TASKARN: "arn:task",
			MIDDY_ECS_FAMILY: "svc",
			MIDDY_ECS_REVISION: "1",
		};
		deepStrictEqual(readEcsEnv(env), {
			accountId: "123",
			region: "us-east-1",
			taskArn: "arn:task",
			family: "svc",
			revision: "1",
		});
	});

	test("readEcsEnv returns empty when no vars set", () => {
		deepStrictEqual(readEcsEnv({}), {});
	});

	test("fetchEcsMetadata returns {} without fetching when env unset", async () => {
		const urls = [];
		const fakeFetch = async (url) => {
			urls.push(url);
			return { ok: true, json: async () => ({ Family: "fam" }) };
		};
		deepStrictEqual(await fetchEcsMetadata(undefined, fakeFetch), {});
		deepStrictEqual(await fetchEcsMetadata("", fakeFetch), {});
		deepStrictEqual(urls, []);
	});

	test("fetchEcsMetadata parses task metadata", async () => {
		const urls = [];
		const fakeFetch = async (url) => {
			urls.push(url);
			return {
				ok: true,
				json: async () => ({
					TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abcdef",
					Family: "fam",
					Revision: 7,
				}),
			};
		};
		const meta = await fetchEcsMetadata("http://localhost/x", fakeFetch);
		// The v4 endpoint exposes task metadata under `${uri}/task`.
		deepStrictEqual(urls, ["http://localhost/x/task"]);
		deepStrictEqual(meta, {
			accountId: "111",
			region: "us-east-1",
			taskArn: "arn:aws:ecs:us-east-1:111:task/cluster/abcdef",
			family: "fam",
			revision: "7",
		});
	});

	test("fetchEcsMetadata returns {} when fetch errors", async () => {
		const fakeFetch = async () => {
			throw new Error("net");
		};
		deepStrictEqual(await fetchEcsMetadata("http://x", fakeFetch), {});
	});

	test("fetchEcsMetadata returns {} when response is not ok", async () => {
		const fakeFetch = async () => ({ ok: false, json: async () => ({}) });
		deepStrictEqual(await fetchEcsMetadata("http://x", fakeFetch), {});
	});

	// --- runWorker / runPrimary / ecsHttpRunner -----------------------------------

	test("runWorker starts http server, handles requests, and drains on SIGTERM", async () => {
		const listenerCount = process.listenerCount("SIGTERM");
		const { server, onSigterm } = await runWorker({
			handler: async () => ({ statusCode: 200, body: "ok" }),
			eventVersion: "2.0",
			requestContext: {},
			port: 0,
			timeout: 1000,
			bodyLimit: 1024,
		});
		const { port } = server.address();
		const res = await fetch(`http://127.0.0.1:${port}/`);
		strictEqual(await res.text(), "ok");
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(process.listenerCount("SIGTERM"), listenerCount);
		server.closeAllConnections?.();
		await new Promise((r) => server.close(r));
	});

	test("runWorker threads trustedProxies through to the request handler", async () => {
		const { server, onSigterm } = await runWorker({
			handler: async (event) => ({
				statusCode: 200,
				body: event.requestContext.http.sourceIp,
			}),
			eventVersion: "2.0",
			requestContext: {},
			port: 0,
			timeout: 1000,
			bodyLimit: 1024,
			trustedProxies: 0,
		});
		try {
			const { port } = server.address();
			const res = await fetch(`http://127.0.0.1:${port}/`, {
				headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" },
			});
			// The worker listens dual-stack, so the socket address may be reported
			// as the IPv4-mapped form (`::ffff:127.0.0.1`).
			const sourceIp = await res.text();
			ok(sourceIp.endsWith("127.0.0.1"), sourceIp);
		} finally {
			process.removeListener("SIGTERM", onSigterm);
			server.closeAllConnections?.();
			await new Promise((r) => server.close(r));
		}
	});

	test("runWorker composes invokedFunctionArn from MIDDY_ECS_* env", async () => {
		process.env.MIDDY_ECS_ACCOUNTID = "999";
		process.env.MIDDY_ECS_REGION = "us-west-2";
		process.env.MIDDY_ECS_FAMILY = "svc-name";
		let captured;
		const { server, onSigterm } = await runWorker({
			handler: async (event, context) => {
				captured = context;
				return { statusCode: 200, body: "" };
			},
			eventVersion: "2.0",
			requestContext: {},
			port: 0,
			timeout: 1000,
			bodyLimit: 1024,
		});
		const { port } = server.address();
		await fetch(`http://127.0.0.1:${port}/`);
		strictEqual(
			captured.invokedFunctionArn,
			"arn:aws:ecs:us-west-2:999:service/svc-name",
		);
		delete process.env.MIDDY_ECS_ACCOUNTID;
		delete process.env.MIDDY_ECS_REGION;
		delete process.env.MIDDY_ECS_FAMILY;
		process.removeListener("SIGTERM", onSigterm);
		server.closeAllConnections?.();
		await new Promise((r) => server.close(r));
	});

	test("runPrimary forks workers and registers SIGTERM forwarder", async () => {
		const forks = [];
		const fakeWorker = { process: { kill: () => {} } };
		const fakeCluster = {
			isPrimary: true,
			workers: { 1: fakeWorker },
			fork: () => {
				forks.push(1);
				return fakeWorker;
			},
			on: noop,
		};
		const fakeFetch = async () => ({
			ok: true,
			json: async () => ({
				TaskARN: "arn:aws:ecs:us-east-1:222:task/c/abc",
				Family: "fam",
				Revision: 1,
			}),
		});
		process.env.ECS_CONTAINER_METADATA_URI_V4 = "http://meta";
		const before = process.listenerCount("SIGTERM");
		const { onSigterm } = await runPrimary(
			{ workers: 3, requestContext: {} },
			{ cluster: fakeCluster, fetch: fakeFetch },
		);
		strictEqual(forks.length, 3);
		strictEqual(process.env.MIDDY_ECS_ACCOUNTID, "222");
		onSigterm();
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(process.listenerCount("SIGTERM"), before);
		delete process.env.ECS_CONTAINER_METADATA_URI_V4;
		delete process.env.MIDDY_ECS_ACCOUNTID;
		delete process.env.MIDDY_ECS_REGION;
		delete process.env.MIDDY_ECS_TASKARN;
		delete process.env.MIDDY_ECS_FAMILY;
		delete process.env.MIDDY_ECS_REVISION;
	});

	// Minimal node:cluster stand-in. `crash(id)` mirrors the primary's bookkeeping:
	// the worker leaves cluster.workers before the last of its exit/disconnect
	// events fires (order between the two is not guaranteed by Node).
	const makeFakeCluster = () => {
		const handlers = {};
		const killed = [];
		let nextId = 1;
		const cluster = {
			isPrimary: true,
			workers: {},
			forks: 0,
			killed,
			fork() {
				const id = nextId++;
				const worker = {
					id,
					process: { kill: (signal) => killed.push([id, signal]) },
				};
				cluster.workers = { ...cluster.workers, [id]: worker };
				cluster.forks++;
				return worker;
			},
			on(ev, fn) {
				handlers[ev] = fn;
			},
			emit(ev, id, ...args) {
				handlers[ev]?.(cluster.workers[id], ...args);
			},
			remove(id) {
				const { [id]: _gone, ...rest } = cluster.workers;
				cluster.workers = rest;
			},
			// node:cluster's exit event: (worker, code, signal); code is null when
			// a signal killed the worker.
			exit(id, code, signal = null) {
				cluster.remove(id);
				handlers.exit(undefined, code, signal);
			},
			crash(id) {
				cluster.exit(id, 1);
			},
		};
		return cluster;
	};

	const noMeta = async () => ({ ok: false });

	test("runPrimary re-forks a crashed worker after a backoff that doubles up to 30 s", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(cluster.forks, 1);
		for (const delayMs of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
			const before = cluster.forks;
			cluster.crash(before);
			t.mock.timers.tick(delayMs - 1);
			strictEqual(cluster.forks, before, `no re-fork before ${delayMs}ms`);
			t.mock.timers.tick(1);
			strictEqual(cluster.forks, before + 1, `re-fork at ${delayMs}ms`);
		}
	});

	test("runPrimary resets the re-fork backoff after 60 s without a worker exit", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		t.mock.timers.tick(1000);
		cluster.crash(2);
		t.mock.timers.tick(2000);
		strictEqual(cluster.forks, 3);
		// Worker 2 died at t=1 s; worker 3 dies at t=61 s, exactly 60 s later. The
		// healthy window is inclusive, so the next delay starts over at 1 s rather
		// than doubling to 4 s.
		t.mock.timers.tick(58_000);
		cluster.crash(3);
		t.mock.timers.tick(999);
		strictEqual(cluster.forks, 3);
		t.mock.timers.tick(1);
		strictEqual(cluster.forks, 4);
	});

	test("runPrimary SIGTERM signals workers, stops re-forking and exits once all are gone", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 2, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		deepStrictEqual(cluster.killed, [
			[1, "SIGTERM"],
			[2, "SIGTERM"],
		]);
		deepStrictEqual(exits, []);
		cluster.exit(1, 0);
		t.mock.timers.tick(60_000);
		strictEqual(cluster.forks, 2, "drained worker is not replaced");
		deepStrictEqual(exits, []);
		cluster.exit(2, 0);
		deepStrictEqual(exits, [0]);
		t.mock.timers.tick(60_000);
		strictEqual(cluster.forks, 2);
		deepStrictEqual(exits, [0], "primary exits exactly once");
	});

	test("runPrimary exits with the highest exit code a worker reported during the drain", async () => {
		// A worker that died non-zero while draining must not let the task report
		// success to ECS.
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 3, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		cluster.exit(1, 2);
		deepStrictEqual(exits, []);
		cluster.exit(2, 1);
		deepStrictEqual(exits, []);
		cluster.exit(3, 0);
		deepStrictEqual(exits, [2]);
	});

	test("runPrimary treats a signal-killed worker as a failed exit", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		cluster.exit(1, null, "SIGKILL");
		deepStrictEqual(exits, [1]);
	});

	test("runPrimary ignores a worker crash before SIGTERM when computing its exit code", async (t) => {
		// A worker that crashed hours earlier was replaced; only the drain decides
		// whether the task reports success to ECS.
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 2, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		t.mock.timers.tick(1000);
		strictEqual(cluster.forks, 3, "crashed worker is replaced");
		deepStrictEqual(exits, []);
		onSigterm();
		deepStrictEqual(cluster.killed, [
			[2, "SIGTERM"],
			[3, "SIGTERM"],
		]);
		cluster.exit(2, 0);
		cluster.exit(3, 0);
		deepStrictEqual(exits, [0]);
	});

	test("runPrimary SIGTERM during a re-fork backoff exits at once and drops the pending fork", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		onSigterm();
		deepStrictEqual(cluster.killed, []);
		// The crash happened before the drain, so it does not taint the exit code.
		deepStrictEqual(exits, [0]);
		t.mock.timers.tick(1000);
		strictEqual(cluster.forks, 1, "pending re-fork is cancelled");
	});

	test("runPrimary exits after the last worker's disconnect when it fires after exit", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		// exit fires first while the worker is still listed; node:cluster removes
		// it before emitting the trailing disconnect.
		cluster.emit("exit", 1, 0);
		deepStrictEqual(exits, []);
		cluster.remove(1);
		cluster.emit("disconnect", 1);
		deepStrictEqual(exits, [0]);
	});

	test("runPrimary ignores worker disconnects while running", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.remove(1);
		cluster.emit("disconnect", 1);
		deepStrictEqual(exits, []);
	});

	test("ecsHttpRunner dispatches to runPrimary when cluster.isPrimary", async () => {
		const fakeCluster = {
			isPrimary: true,
			workers: {},
			fork: noop,
			on: noop,
		};
		const { onSigterm } = await ecsHttpRunner(
			{ handler: noop, workers: 1 },
			{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
		);
		ok(typeof onSigterm === "function");
		process.removeListener("SIGTERM", onSigterm);
	});

	test("ecsHttpRunner dispatches to runWorker when not primary", async () => {
		const fakeCluster = { isPrimary: false };
		const { server, onSigterm } = await ecsHttpRunner(
			{
				handler: async () => ({ statusCode: 200, body: "" }),
				port: 0,
				workers: 1,
			},
			{ cluster: fakeCluster },
		);
		ok(server.listening);
		process.removeListener("SIGTERM", onSigterm);
		server.closeAllConnections?.();
		await new Promise((r) => server.close(r));
	});

	test("ecsHttpRunner validates options with default cluster impl when no deps", async () => {
		await rejects(ecsHttpRunner({}), TypeError);
	});

	test("runPrimary uses default cluster impl when none injected", async () => {
		delete process.env.ECS_CONTAINER_METADATA_URI_V4;
		const { onSigterm } = await runPrimary({
			workers: 0,
			requestContext: {},
		});
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary onSigterm tolerates missing cluster.workers and exits at once", async () => {
		const fakeCluster = {
			isPrimary: true,
			fork: noop,
			on: noop,
		};
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 0, requestContext: {} },
			{
				cluster: fakeCluster,
				fetch: async () => ({ ok: false }),
				exit: (code) => exits.push(code),
			},
		);
		onSigterm();
		deepStrictEqual(exits, [0]);
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary onSigterm handles undefined worker entries", async () => {
		const fakeCluster = {
			isPrimary: true,
			workers: { 1: undefined },
			fork: noop,
			on: noop,
		};
		const { onSigterm } = await runPrimary(
			{ workers: 0, requestContext: {} },
			{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
		);
		onSigterm();
		process.removeListener("SIGTERM", onSigterm);
	});

	test("buildEventV2 falls back to dynamic protocol for unknown httpVersion", () => {
		const event = buildEventV2({
			req: makeReq({ httpVersion: "9.9" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.requestContext.http.protocol, "HTTP/9.9");
	});

	test("integration: text/* content-type passes through as utf-8", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/p`, {
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "hello",
		});
		const body = await res.json();
		strictEqual(body.body, "hello");
		strictEqual(body.isBase64Encoded, false);
		await close();
	});

	test("integration: application/json with charset suffix passes through as utf-8", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/p`, {
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: '{"a":1}',
		});
		const body = await res.json();
		strictEqual(body.body, '{"a":1}');
		strictEqual(body.isBase64Encoded, false);
		await close();
	});

	test("integration: application/xml content-type passes through as utf-8 (regex fallback)", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/p`, {
			method: "POST",
			headers: { "content-type": "application/xml" },
			body: "<x/>",
		});
		const body = await res.json();
		strictEqual(body.body, "<x/>");
		strictEqual(body.isBase64Encoded, false);
		await close();
	});

	test("buildEventV2 passes URL through (node:http pre-validates the request line)", () => {
		const event = buildEventV2({
			req: makeReq({ url: "//foo?x=1" }),
			body: Buffer.alloc(0),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.rawPath, "//foo");
		strictEqual(event.rawQueryString, "x=1");
	});

	test("buildEventAlb encodes utf-8 body when not base64", () => {
		const event = buildEventAlb({
			req: makeReq(),
			body: Buffer.from("plain"),
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "",
			requestId: "r",
		});
		strictEqual(event.body, "plain");
	});

	test("integration: writeError defaults missing message to empty string", async () => {
		const { url, close } = await startWith({
			handler: () => {
				throw { statusCode: 400 };
			},
		});
		const res = await fetch(`${url}/x`);
		strictEqual(res.status, 400);
		const body = await res.json();
		strictEqual(body.message, "");
		await close();
	});

	test("integration: body without content-type header treated as text", async () => {
		const server = http.createServer(
			createRequestHandler({
				handler: async (event) => ({
					statusCode: 200,
					body: JSON.stringify({ isBase64Encoded: event.isBase64Encoded }),
				}),
				eventVersion: "2.0",
				requestContext: {},
				timeout: 1000,
				bodyLimit: 1024,
				invokedFunctionArn: undefined,
			}),
		);
		await new Promise((r) => server.listen(0, "127.0.0.1", r));
		const { port } = server.address();
		// Raw HTTP request with no Content-Type header
		const sock = await new Promise((resolve) => {
			const req = http.request(
				{ host: "127.0.0.1", port, path: "/", method: "POST" },
				(res) => {
					let data = "";
					res.on("data", (d) => {
						data += d;
					});
					res.on("end", () => resolve({ status: res.statusCode, data }));
				},
			);
			req.write("hello");
			req.end();
		});
		const parsed = JSON.parse(sock.data);
		strictEqual(parsed.isBase64Encoded, false);
		server.closeAllConnections?.();
		await new Promise((r) => server.close(r));
	});

	test("runWorker uses injected http impl", async () => {
		let createCalled = false;
		const fakeServer = {
			listen(_port, cb) {
				cb();
			},
			address() {
				return { port: 0 };
			},
			close(cb) {
				cb();
			},
			listening: true,
		};
		const fakeHttp = {
			createServer() {
				createCalled = true;
				return fakeServer;
			},
		};
		const { onSigterm } = await runWorker(
			{
				handler: noop,
				eventVersion: "2.0",
				requestContext: {},
				port: 0,
				timeout: 1000,
				bodyLimit: 1024,
			},
			{ http: fakeHttp, exit: noop },
		);
		ok(createCalled);
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary uses default fetch when none injected", async () => {
		const fakeCluster = {
			isPrimary: true,
			workers: {},
			fork: noop,
			on: noop,
		};
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster: fakeCluster },
		);
		process.removeListener("SIGTERM", onSigterm);
	});

	test("writeResponse handles result with body but no statusCode", () => {
		const res = fakeRes();
		writeResponse(res, { body: "abc" });
		strictEqual(res._calls.body, "abc");
		strictEqual(res._calls.writeHead.code, 200);
	});

	test("writeResponse skips set-cookie header when cookies is empty array", () => {
		const res = fakeRes();
		writeResponse(res, { statusCode: 200, body: "ok", cookies: [] });
		strictEqual(res._calls.writeHead.headers["set-cookie"], undefined);
	});

	test("writeResponse handles non-string non-object result (number)", () => {
		const res = fakeRes();
		writeResponse(res, 42);
		strictEqual(res._calls.writeHead.code, 200);
	});

	test("fetchEcsMetadata handles missing TaskARN and Revision", async () => {
		const fakeFetch = async () => ({
			ok: true,
			json: async () => ({ Family: "fam" }),
		});
		const meta = await fetchEcsMetadata("http://x", fakeFetch);
		strictEqual(meta.taskArn, undefined);
		strictEqual(meta.revision, undefined);
		strictEqual(meta.family, "fam");
	});

	test("composeInvokedFunctionArn covered via runWorker with partial env", async () => {
		process.env.MIDDY_ECS_ACCOUNTID = "1";
		let captured;
		const { server, onSigterm } = await runWorker(
			{
				handler: async (event, context) => {
					captured = context;
					return "";
				},
				eventVersion: "2.0",
				requestContext: {},
				port: 0,
				timeout: 1000,
				bodyLimit: 1024,
			},
			{ exit: noop },
		);
		const { port } = server.address();
		await fetch(`http://127.0.0.1:${port}/`);
		strictEqual(captured.invokedFunctionArn, undefined);
		delete process.env.MIDDY_ECS_ACCOUNTID;
		process.removeListener("SIGTERM", onSigterm);
		server.closeAllConnections?.();
		await new Promise((r) => server.close(r));
	});

	test("integration: missing user-agent and cookie still works", async () => {
		const { url, close } = await startWith();
		const res = await fetch(`${url}/path`, {
			headers: { "user-agent": "" },
		});
		strictEqual(res.status, 200);
		await close();
	});

	test("integration: v1 with empty body still parses", async () => {
		const { url, close } = await startWith({ eventVersion: "1.0" });
		const res = await fetch(`${url}/v1`, { method: "POST" });
		strictEqual(res.status, 200);
		await close();
	});

	test("drainAndExit closes server and calls exit(0)", async () => {
		let exited;
		const fakeServer = {
			close(cb) {
				cb();
			},
		};
		await drainAndExit(fakeServer, (code) => {
			exited = code;
		});
		strictEqual(exited, 0);
	});

	test("runWorker onSigterm drains and exits via injected exit", async () => {
		let exited;
		const { server, onSigterm } = await runWorker(
			{
				handler: async () => ({ statusCode: 200, body: "" }),
				eventVersion: "2.0",
				requestContext: {},
				port: 0,
				timeout: 1000,
				bodyLimit: 1024,
			},
			{
				exit: (code) => {
					exited = code;
				},
			},
		);
		process.removeListener("SIGTERM", onSigterm);
		await onSigterm();
		strictEqual(exited, 0);
		strictEqual(server.listening, false);
	});

	// --- createRequestHandler driven with a fake request -----------------------
	//
	// Body chunks are emitted after the handler has attached its listeners, then
	// "end", so the whole read path runs without a socket. `capture` records the
	// event/context the handler saw so tests can assert complete shapes.

	const dispatch = async (
		requestHandler,
		req,
		chunks = [],
		{ end = true } = {},
	) => {
		const res = fakeRes();
		const pending = requestHandler(req, res);
		for (const chunk of chunks) req.emit("data", Buffer.from(chunk));
		if (end) req.emit("end");
		await pending;
		return res._calls;
	};

	const capture = (overrides = {}) => {
		const seen = {};
		const requestHandler = createRequestHandler({
			handler: async (event, context) => {
				seen.event = event;
				seen.context = context;
				return { statusCode: 200, body: "" };
			},
			eventVersion: "2.0",
			requestContext: {},
			timeout: 1000,
			bodyLimit: 1024,
			trustedProxies: 1,
			invokedFunctionArn: undefined,
			...overrides,
		});
		return { seen, requestHandler };
	};

	test("request handler: a request with neither content-length nor transfer-encoding has no body", async () => {
		const { seen, requestHandler } = capture();
		const req = makeReq({
			method: "POST",
			headers: { "content-type": "application/octet-stream" },
		});
		const calls = await dispatch(requestHandler, req);
		strictEqual(calls.writeHead.code, 200);
		// The body is never read, so no stream listeners are attached at all.
		strictEqual(req.listenerCount("data"), 0);
		strictEqual(seen.event.body, undefined);
		strictEqual(seen.event.isBase64Encoded, false);
	});

	test("request handler: content-length 0 or empty means no body", async () => {
		for (const cl of ["0", ""]) {
			const { seen, requestHandler } = capture();
			const req = makeReq({
				method: "POST",
				headers: {
					"content-type": "application/octet-stream",
					"content-length": cl,
				},
			});
			const calls = await dispatch(requestHandler, req);
			strictEqual(calls.writeHead.code, 200);
			strictEqual(req.listenerCount("data"), 0, `content-length ${cl}`);
			strictEqual(seen.event.body, undefined);
			strictEqual(seen.event.isBase64Encoded, false);
		}
	});

	test("request handler: chunked transfer-encoding without content-length reads the body", async () => {
		const { seen, requestHandler } = capture();
		const req = makeReq({
			method: "POST",
			headers: { "transfer-encoding": "chunked" },
		});
		const calls = await dispatch(requestHandler, req, ["ab", "c"]);
		strictEqual(calls.writeHead.code, 200);
		strictEqual(seen.event.body, "abc");
		strictEqual(seen.event.isBase64Encoded, false);
	});

	test("request handler: a body exactly at bodyLimit is accepted", async () => {
		const { seen, requestHandler } = capture({ bodyLimit: 16 });
		const req = makeReq({
			method: "POST",
			headers: { "content-length": "16" },
		});
		const calls = await dispatch(requestHandler, req, ["x".repeat(16)]);
		strictEqual(calls.writeHead.code, 200);
		strictEqual(seen.event.body, "x".repeat(16));
		strictEqual(req.destroyed, false);
	});

	test("request handler: a body over bodyLimit is rejected with 413 and the socket destroyed", async () => {
		const { seen, requestHandler } = capture({ bodyLimit: 16 });
		const req = makeReq({
			method: "POST",
			headers: { "content-length": "17" },
		});
		// "end" still fires after the oversize chunk; the 413 already written wins.
		const calls = await dispatch(requestHandler, req, ["x".repeat(17)]);
		deepStrictEqual(calls.writeHead, {
			code: 413,
			headers: { "content-type": "application/json" },
		});
		deepStrictEqual(calls.endArgs, ['{"message":"Payload too large"}']);
		strictEqual(req.destroyed, true);
		strictEqual(seen.event, undefined, "handler is not invoked");
	});

	test("request handler: a stream error while reading the body yields 500", async () => {
		const { seen, requestHandler } = capture();
		const req = makeReq({
			method: "POST",
			headers: { "content-length": "3" },
		});
		const res = fakeRes();
		const pending = requestHandler(req, res);
		req.emit("error", new Error("aborted"));
		await pending;
		deepStrictEqual(res._calls.writeHead, {
			code: 500,
			headers: { "content-type": "application/json" },
		});
		deepStrictEqual(res._calls.endArgs, [
			'{"message":"Internal Server Error"}',
		]);
		strictEqual(seen.event, undefined);
	});

	test("request handler: text detection by content-type", async () => {
		for (const [contentType, isBase64Encoded] of [
			["application/json", false],
			["APPLICATION/JSON", false],
			["application/json; charset=utf-8", false],
			["text/plain; charset=utf-8", false],
			["TEXT/HTML", false],
			["application/xml", false],
			["application/soap+xml; charset=utf-8", false],
			["application/ld+json", false],
			["application/vnd.github+json", false],
			["application/vnd.api+json", false],
			["application/vnd.my-org.v2+json", false],
			["application/x-www-form-urlencoded", false],
			["application/javascript", false],
			["application/graphql", false],
			["application/octet-stream", true],
			["application/zip", true],
			["application/vnd.ms-excel", true],
			["application/pdf; type=json", true],
			["image/png", true],
			["image/svg+xml", true],
			// A text type mentioned inside a parameter does not make the body text.
			["multipart/related; type=text/html; boundary=b", true],
			["multipart/form-data; boundary=text/", true],
			["multipart/related; type=application/json;", true],
		]) {
			const { seen, requestHandler } = capture();
			const req = makeReq({
				method: "POST",
				headers: { "content-type": contentType, "content-length": "2" },
			});
			await dispatch(requestHandler, req, ["hi"]);
			strictEqual(seen.event.isBase64Encoded, isBase64Encoded, contentType);
			strictEqual(
				seen.event.body,
				isBase64Encoded ? "aGk=" : "hi",
				contentType,
			);
		}
	});

	test("request handler: builds the whole v2 event and context", async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 10_000 });
		const { seen, requestHandler } = capture({
			requestContext: { accountId: "111" },
			invokedFunctionArn: "arn:aws:ecs:us-east-1:111:service/svc",
		});
		const headers = {
			host: "h",
			"user-agent": "ua/1",
			"x-forwarded-for": "6.6.6.6, 203.0.113.9",
			"x-amzn-trace-id": "Root=1-abc",
			"content-type": "text/plain",
			"content-length": "2",
		};
		const req = makeReq({ method: "PUT", url: "/p?a=1", headers });
		const calls = await dispatch(requestHandler, req, ["hi"]);
		deepStrictEqual(calls.writeHead, { code: 200, headers: {} });
		deepStrictEqual(seen.event, {
			version: "2.0",
			routeKey: "$default",
			rawPath: "/p",
			rawQueryString: "a=1",
			cookies: undefined,
			headers,
			queryStringParameters: nullProto({ a: "1" }),
			requestContext: {
				accountId: "111",
				requestId: "Root=1-abc",
				http: {
					method: "PUT",
					path: "/p",
					protocol: "HTTP/1.1",
					sourceIp: "203.0.113.9",
					userAgent: "ua/1",
				},
				timeEpoch: 10_000,
			},
			body: "hi",
			isBase64Encoded: false,
		});
		strictEqual(seen.context.awsRequestId, "Root=1-abc");
		strictEqual(
			seen.context.invokedFunctionArn,
			"arn:aws:ecs:us-east-1:111:service/svc",
		);
		strictEqual(seen.context.getRemainingTimeInMillis(), 1000);
	});

	test("request handler: a request whose socket is gone gets an empty sourceIp", async () => {
		const { seen, requestHandler } = capture();
		const calls = await dispatch(requestHandler, makeReq({ socket: null }));
		strictEqual(calls.writeHead.code, 200);
		strictEqual(seen.event.requestContext.http.sourceIp, "");
	});

	test("request handler: error responses are JSON with the error's status", async () => {
		const requestHandler = createRequestHandler({
			handler: () => {
				const e = new Error("nope");
				e.statusCode = 418;
				throw e;
			},
			eventVersion: "2.0",
			requestContext: {},
			timeout: 1000,
			bodyLimit: 1024,
		});
		const calls = await dispatch(requestHandler, makeReq());
		deepStrictEqual(calls.writeHead, {
			code: 418,
			headers: { "content-type": "application/json" },
		});
		deepStrictEqual(calls.endArgs, ['{"message":"nope"}']);
	});

	test("request handler: a 4xx error without a message reports an empty one", async () => {
		const requestHandler = createRequestHandler({
			handler: () => {
				throw { statusCode: 404 };
			},
			eventVersion: "2.0",
			requestContext: {},
			timeout: 1000,
			bodyLimit: 1024,
		});
		const calls = await dispatch(requestHandler, makeReq());
		deepStrictEqual(calls.writeHead, {
			code: 404,
			headers: { "content-type": "application/json" },
		});
		deepStrictEqual(calls.endArgs, ['{"message":""}']);
	});

	test("request handler: only a numeric statusCode >= 400 is honored, else 500", async () => {
		for (const thrown of [
			{ statusCode: "418", message: "string code" },
			{ statusCode: 302, message: "redirect" },
			{ statusCode: 399, message: "below 400" },
			null,
			undefined,
		]) {
			const requestHandler = createRequestHandler({
				handler: () => {
					throw thrown;
				},
				eventVersion: "2.0",
				requestContext: {},
				timeout: 1000,
				bodyLimit: 1024,
			});
			const calls = await dispatch(requestHandler, makeReq());
			deepStrictEqual(
				calls.writeHead,
				{ code: 500, headers: { "content-type": "application/json" } },
				JSON.stringify(thrown),
			);
			deepStrictEqual(calls.endArgs, ['{"message":"Internal Server Error"}']);
		}
	});

	// --- runWorker / ecsHttpRunner with an injected http module ----------------

	const fakeHttp = () => {
		const calls = { listen: undefined };
		const server = {
			listen(port, cb) {
				calls.listen = port;
				cb();
			},
			close(cb) {
				cb();
			},
			listening: true,
		};
		return {
			calls,
			server,
			http: {
				createServer(requestHandler) {
					calls.requestHandler = requestHandler;
					return server;
				},
			},
		};
	};

	const ecsEnvKeys = ["ACCOUNTID", "REGION", "TASKARN", "FAMILY", "REVISION"];
	const withEcsEnv = (t, values) => {
		for (const key of ecsEnvKeys) delete process.env[`MIDDY_ECS_${key}`];
		for (const [key, value] of Object.entries(values)) {
			process.env[`MIDDY_ECS_${key}`] = value;
		}
		t.after(() => {
			for (const key of ecsEnvKeys) delete process.env[`MIDDY_ECS_${key}`];
		});
	};

	test("runWorker merges ECS env and requestContext option into the event", async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 42 });
		withEcsEnv(t, {
			ACCOUNTID: "999",
			REGION: "us-west-2",
			FAMILY: "svc-name",
		});
		const seen = {};
		const { calls, http, server } = fakeHttp();
		const { onSigterm } = await runWorker(
			{
				handler: async (event, context) => {
					seen.event = event;
					seen.context = context;
					return { statusCode: 200, body: "" };
				},
				eventVersion: "2.0",
				requestContext: { stage: "prod" },
				port: 8080,
				timeout: 5000,
				bodyLimit: 1024,
				trustedProxies: 1,
			},
			{ http, exit: noop },
		);
		ok(process.listeners("SIGTERM").includes(onSigterm));
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(calls.listen, 8080);
		strictEqual(server.requestTimeout, 5000);
		strictEqual(server.keepAliveTimeout, 65_000);
		strictEqual(server.headersTimeout, 70_000);
		const headers = { host: "h" };
		await dispatch(calls.requestHandler, makeReq({ headers }));
		deepStrictEqual(seen.event.requestContext, {
			accountId: "999",
			region: "us-west-2",
			family: "svc-name",
			stage: "prod",
			requestId: "",
			http: {
				method: "GET",
				path: "/",
				protocol: "HTTP/1.1",
				sourceIp: "127.0.0.1",
				userAgent: "",
			},
			timeEpoch: 42,
		});
		strictEqual(
			seen.context.invokedFunctionArn,
			"arn:aws:ecs:us-west-2:999:service/svc-name",
		);
	});

	test("runWorker leaves invokedFunctionArn undefined unless region, account and family are all known", async (t) => {
		for (const env of [
			{ ACCOUNTID: "999", FAMILY: "svc-name" },
			{ REGION: "us-west-2", FAMILY: "svc-name" },
			{ ACCOUNTID: "999", REGION: "us-west-2" },
		]) {
			withEcsEnv(t, env);
			const seen = {};
			const { calls, http } = fakeHttp();
			const { onSigterm } = await runWorker(
				{
					handler: async (_event, context) => {
						seen.context = context;
						return "";
					},
					eventVersion: "2.0",
					requestContext: {},
					port: 0,
					timeout: 1000,
					bodyLimit: 1024,
				},
				{ http, exit: noop },
			);
			process.removeListener("SIGTERM", onSigterm);
			await dispatch(calls.requestHandler, makeReq());
			strictEqual(
				seen.context.invokedFunctionArn,
				undefined,
				JSON.stringify(env),
			);
		}
	});

	test("ecsHttpRunner applies the documented defaults to the worker", async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
		const seen = {};
		const { calls, http, server } = fakeHttp();
		const { onSigterm } = await ecsHttpRunner(
			{
				handler: async (event, context) => {
					seen.event = event;
					seen.context = context;
					return { statusCode: 200, body: "" };
				},
			},
			{ cluster: { isPrimary: false }, http, exit: noop },
		);
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(calls.listen, 80);
		strictEqual(server.requestTimeout, 60_000);
		const headers = { host: "h", "x-forwarded-for": "6.6.6.6, 203.0.113.9" };
		await dispatch(calls.requestHandler, makeReq({ headers }));
		deepStrictEqual(seen.event, {
			version: "2.0",
			routeKey: "$default",
			rawPath: "/",
			rawQueryString: "",
			cookies: undefined,
			headers,
			queryStringParameters: undefined,
			requestContext: {
				requestId: "",
				http: {
					method: "GET",
					path: "/",
					protocol: "HTTP/1.1",
					sourceIp: "203.0.113.9",
					userAgent: "",
				},
				timeEpoch: 1_000,
			},
			body: undefined,
			isBase64Encoded: false,
		});
		strictEqual(seen.context.getRemainingTimeInMillis(), 60_000);
	});

	test("ecsHttpRunner default bodyLimit is 10 MiB", async () => {
		const limit = 10 * 1024 * 1024;
		const { calls, http } = fakeHttp();
		const { onSigterm } = await ecsHttpRunner(
			{
				handler: async (event) => ({
					statusCode: 200,
					body: String(event.body.length),
				}),
			},
			{ cluster: { isPrimary: false }, http, exit: noop },
		);
		process.removeListener("SIGTERM", onSigterm);
		const post = (size) =>
			dispatch(
				calls.requestHandler,
				makeReq({
					method: "POST",
					headers: {
						"content-type": "text/plain",
						"content-length": String(size),
					},
				}),
				[Buffer.alloc(size, "x")],
			);
		const atLimit = await post(limit);
		strictEqual(atLimit.writeHead.code, 200);
		deepStrictEqual(atLimit.endArgs, [String(limit)]);
		const overLimit = await post(limit + 1);
		strictEqual(overLimit.writeHead.code, 413);
	});

	test("runPrimary registers onSigterm as a SIGTERM listener", async () => {
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1, requestContext: {} },
			{ cluster, fetch: noMeta, exit: noop },
		);
		ok(process.listeners("SIGTERM").includes(onSigterm));
		process.removeListener("SIGTERM", onSigterm);
	});
});
