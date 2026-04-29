// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
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

const noop = () => {};

const makeReq = ({
	method = "GET",
	url = "/",
	headers = {},
	httpVersion = "1.1",
	socket = { remoteAddress: "127.0.0.1" },
} = {}) => ({ method, url, headers, httpVersion, socket });

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

test("ecsHttpValidateOptions rejects unknown property", () => {
	throws(
		() => ecsHttpValidateOptions({ handler: noop, foo: "bar" }),
		TypeError,
	);
});

// --- helpers ----------------------------------------------------------------

test("lowercaseHeaders lowercases keys and joins arrays", () => {
	deepStrictEqual(
		lowercaseHeaders({ "Content-Type": "text/plain", "X-A": ["1", "2"] }),
		{ "content-type": "text/plain", "x-a": "1,2" },
	);
});

test("resolveSourceIp prefers X-Forwarded-For first hop", () => {
	strictEqual(
		resolveSourceIp({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }, "127.0.0.1"),
		"9.9.9.9",
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

test("resolveRequestId honors X-Amzn-Trace-Id", () => {
	strictEqual(
		resolveRequestId({ "x-amzn-trace-id": "Root=1-abc" }),
		"Root=1-abc",
	);
});

test("resolveRequestId returns empty string when no trace header (no UUID generation)", () => {
	strictEqual(resolveRequestId({}), "");
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
	strictEqual(ctx.callbackWaitsForEmptyEventLoop, false);
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
	const event = buildEventV2({
		req: makeReq({
			method: "POST",
			url: "/users?a=1&b=2",
			headers: { "user-agent": "ua/1", cookie: "x=1; y=2" },
		}),
		body: Buffer.from("hello"),
		isBase64Encoded: false,
		requestContext: { accountId: "111" },
		sourceIp: "9.9.9.9",
		requestId: "rid-1",
	});
	strictEqual(event.version, "2.0");
	strictEqual(event.rawPath, "/users");
	strictEqual(event.rawQueryString, "a=1&b=2");
	deepStrictEqual(event.cookies, ["x=1", "y=2"]);
	strictEqual(event.requestContext.http.method, "POST");
	strictEqual(event.requestContext.http.sourceIp, "9.9.9.9");
	strictEqual(event.requestContext.requestId, "rid-1");
	strictEqual(event.requestContext.accountId, "111");
	strictEqual(event.body, "hello");
	strictEqual(event.isBase64Encoded, false);
	deepStrictEqual({ ...event.queryStringParameters }, { a: "1", b: "2" });
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
	const event = buildEventV1({
		req: makeReq({
			method: "GET",
			url: "/x?a=1&a=2",
			headers: { "x-a": ["1", "2"] },
		}),
		body: Buffer.alloc(0),
		isBase64Encoded: false,
		requestContext: {},
		sourceIp: "1.1.1.1",
		requestId: "rid",
	});
	strictEqual(event.httpMethod, "GET");
	strictEqual(event.path, "/x");
	deepStrictEqual({ ...event.queryStringParameters }, { a: "2" });
	deepStrictEqual(
		{ ...event.multiValueQueryStringParameters },
		{ a: ["1", "2"] },
	);
	deepStrictEqual(event.multiValueHeaders["x-a"], ["1", "2"]);
	strictEqual(event.body, null);
	strictEqual(event.requestContext.identity.sourceIp, "1.1.1.1");
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
	const event = buildEventAlb({
		req: makeReq({ url: "/health?ok=1", headers: { "user-agent": "elb/1" } }),
		body: Buffer.alloc(0),
		isBase64Encoded: false,
		requestContext: { elb: { targetGroupArn: "arn:..." } },
		sourceIp: "10.0.0.1",
		requestId: "rid",
	});
	strictEqual(event.httpMethod, "GET");
	strictEqual(event.path, "/health");
	deepStrictEqual({ ...event.queryStringParameters }, { ok: "1" });
	strictEqual(event.requestContext.elb.targetGroupArn, "arn:...");
	strictEqual(event.body, "");
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
	const calls = { writeHead: null, body: null, ended: false, destroyed: false };
	return {
		headersSent: false,
		writeHead(code, headers) {
			calls.writeHead = { code, headers };
			this.headersSent = true;
		},
		end(body) {
			calls.body = body;
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
	strictEqual(res._calls.writeHead.headers["content-type"], "application/json");
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
	deepStrictEqual(res._calls.writeHead.headers["set-cookie"], ["a=1", "b=2"]);
	strictEqual(res._calls.body, "ok");
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
	strictEqual(res._calls.writeHead.code, 200);
	strictEqual(res._calls.body, undefined);
	ok(res._calls.ended);
});

test("writeResponse handles {statusCode} with no body", () => {
	const res = fakeRes();
	writeResponse(res, { statusCode: 204 });
	strictEqual(res._calls.writeHead.code, 204);
	strictEqual(res._calls.body, undefined);
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

test("fetchEcsMetadata returns {} when env unset", async () => {
	deepStrictEqual(await fetchEcsMetadata(undefined, async () => ({})), {});
});

test("fetchEcsMetadata parses task metadata", async () => {
	const fakeFetch = async () => ({
		ok: true,
		json: async () => ({
			TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abcdef",
			Family: "fam",
			Revision: 7,
		}),
	});
	const meta = await fetchEcsMetadata("http://localhost/x", fakeFetch);
	strictEqual(meta.accountId, "111");
	strictEqual(meta.region, "us-east-1");
	strictEqual(meta.family, "fam");
	strictEqual(meta.revision, "7");
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

test("runPrimary cluster.on('exit') re-forks", async () => {
	let exitHandler;
	let forkCount = 0;
	const fakeCluster = {
		isPrimary: true,
		workers: {},
		fork: () => {
			forkCount++;
			return { process: { kill: noop } };
		},
		on: (ev, fn) => {
			if (ev === "exit") exitHandler = fn;
		},
	};
	const { onSigterm } = await runPrimary(
		{ workers: 1, requestContext: {} },
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	strictEqual(forkCount, 1);
	exitHandler();
	strictEqual(forkCount, 2);
	process.removeListener("SIGTERM", onSigterm);
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

test("runPrimary onSigterm tolerates missing cluster.workers", async () => {
	const fakeCluster = {
		isPrimary: true,
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
