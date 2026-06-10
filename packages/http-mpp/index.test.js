import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	strictEqual,
	throws,
} from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpMpp, { httpMppValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const defaultMethods = [
	{
		method: "tempo",
		recipient: "0x1234567890123456789012345678901234567890",
		currency: "0xabcdef0123456789012345678901234567890123",
		amount: 0.01,
	},
];

// *** challenge - missing/wrong Authorization ***

test("Should return 402 with WWW-Authenticate when no Authorization header (v1.0 event)", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { httpMethod: "GET", headers: {} };
	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 402,
		headers: {
			"WWW-Authenticate":
				'MPP realm="api", method="tempo", params="recipient=0x1234567890123456789012345678901234567890,currency=0xabcdef0123456789012345678901234567890123,amount=0.01"',
		},
	});
});

test("Should return 402 with WWW-Authenticate when no Authorization header (v2.0 event)", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = {
		version: "2.0",
		requestContext: { http: { method: "GET" } },
		headers: {},
	};
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
	ok(response.headers["WWW-Authenticate"].startsWith("MPP "));
});

test("Should return 402 when Authorization header has wrong scheme", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { headers: { Authorization: "Bearer sometoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
	ok(response.headers["WWW-Authenticate"]);
});

test("Should return 402 when Authorization header is Basic scheme", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { headers: { Authorization: "Basic dXNlcjpwYXNz" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
});

test("Should return 402 when event has no headers property", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = {};
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
});

test("Should not call handler when Authorization is absent", async () => {
	let handlerCalled = false;
	const handler = middy(() => {
		handlerCalled = true;
		return { statusCode: 200 };
	});
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { headers: {} };
	await handler(event, defaultContext);

	strictEqual(handlerCalled, false);
});

// *** token present, no verify (dev mode) ***

test("Should allow request when MPP token present and no verify option", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { headers: { Authorization: "MPP sometoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
});

test("Should allow request with lowercase authorization header (APIGW v2)", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(httpMpp({ methods: defaultMethods }));

	const event = { headers: { authorization: "MPP sometoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
});

// *** verify function ***

test("Should allow request when verify returns true", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: async () => true,
		}),
	);

	const event = { headers: { Authorization: "MPP validtoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
});

test("Should return 402 when verify returns false", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: async () => false,
		}),
	);

	const event = { headers: { Authorization: "MPP badtoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
	ok(response.headers["WWW-Authenticate"]);
});

test("Should return 402 when verify throws", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: async () => {
				throw new Error("network error");
			},
		}),
	);

	const event = { headers: { Authorization: "MPP sometoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
});

test("Should pass token string to verify without MPP prefix", async () => {
	let capturedToken = null;
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: async (token) => {
				capturedToken = token;
				return true;
			},
		}),
	);

	const event = { headers: { Authorization: "MPP mytoken123" } };
	await handler(event, defaultContext);

	strictEqual(capturedToken, "mytoken123");
});

test("Should pass request object to verify as second argument", async () => {
	let capturedRequest = null;
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: async (token, request) => {
				capturedRequest = request;
				return true;
			},
		}),
	);

	const event = { headers: { Authorization: "MPP sometoken" } };
	await handler(event, defaultContext);

	ok(capturedRequest);
	ok(capturedRequest.event);
});

test("Should support async verify returning Promise", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: defaultMethods,
			verify: (token) => Promise.resolve(token === "validtoken"),
		}),
	);

	const event = { headers: { Authorization: "MPP validtoken" } };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 200);
});

// *** WWW-Authenticate header format ***

test("Should format WWW-Authenticate header with correct realm, method, and params", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: [
				{
					method: "tempo",
					recipient: "0xabc",
					currency: "0xdef",
					amount: 0.01,
				},
			],
		}),
	);

	const event = { headers: {} };
	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["WWW-Authenticate"],
		'MPP realm="api", method="tempo", params="recipient=0xabc,currency=0xdef,amount=0.01"',
	);
});

test("Should use custom realm in WWW-Authenticate", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			realm: "myapp",
			methods: [
				{
					method: "tempo",
					recipient: "0xabc",
					currency: "0xdef",
					amount: 0.01,
				},
			],
		}),
	);

	const event = { headers: {} };
	const response = await handler(event, defaultContext);

	ok(response.headers["WWW-Authenticate"].includes('realm="myapp"'));
});

test("Should use default realm 'api' when not specified", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: [
				{ method: "tempo", recipient: "0x", currency: "0x", amount: 0.01 },
			],
		}),
	);

	const event = { headers: {} };
	const response = await handler(event, defaultContext);

	ok(response.headers["WWW-Authenticate"].includes('realm="api"'));
});

test("Should set multiValueHeaders for multiple payment methods", async () => {
	const handler = middy(() => ({ statusCode: 200 }));
	handler.use(
		httpMpp({
			methods: [
				{
					method: "tempo",
					recipient: "0xabc",
					currency: "0xdef",
					amount: 0.01,
				},
				{
					method: "lightning",
					recipient: "lnbc...",
					currency: "BTC",
					amount: 0.0001,
				},
			],
		}),
	);

	const event = { headers: {} };
	const response = await handler(event, defaultContext);

	strictEqual(response.statusCode, 402);
	strictEqual(
		Array.isArray(response.multiValueHeaders["WWW-Authenticate"]),
		true,
	);
	strictEqual(response.multiValueHeaders["WWW-Authenticate"].length, 2);
});

// *** validateOptions ***

test("httpMppValidateOptions accepts valid options", () => {
	doesNotThrow(() =>
		httpMppValidateOptions({
			realm: "api",
			methods: [
				{
					method: "tempo",
					recipient: "0x",
					currency: "0x",
					amount: 0.01,
				},
			],
			verify: () => true,
		}),
	);
});

test("httpMppValidateOptions accepts empty options object", () => {
	doesNotThrow(() => httpMppValidateOptions({}));
});

test("httpMppValidateOptions rejects unknown top-level keys", () => {
	throws(() => httpMppValidateOptions({ unknownKey: "value" }));
});

test("httpMppValidateOptions rejects non-positive amount", () => {
	throws(() =>
		httpMppValidateOptions({
			methods: [
				{ method: "tempo", recipient: "0x", currency: "0x", amount: 0 },
			],
		}),
	);
});

test("httpMppValidateOptions rejects negative amount", () => {
	throws(() =>
		httpMppValidateOptions({
			methods: [
				{ method: "tempo", recipient: "0x", currency: "0x", amount: -1 },
			],
		}),
	);
});

test("httpMppValidateOptions rejects non-function verify", () => {
	throws(() => httpMppValidateOptions({ verify: "not-a-function" }));
});

// *** construction errors ***

test("Should throw at construction when methods is empty array", () => {
	throws(() => httpMpp({ methods: [] }), {
		message: "options.methods must be a non-empty array",
	});
});

test("Should throw at construction when methods is not provided", () => {
	throws(() => httpMpp({}), {
		message: "options.methods must be a non-empty array",
	});
});
