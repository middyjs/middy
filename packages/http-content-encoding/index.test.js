import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { createReadableStream, streamToBuffer } from "@datastream/core";
import middy from "../core/index.js";
import httpContentEncoding from "./index.js";

const context = {
	getRemainingTimeInMillis: () => 1000,
};

const compressibleBody = JSON.stringify(new Array(100).fill(0));

test("It should encode string using br", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: brotliCompressSync(body).toString("base64"),
		headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode stream using br", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: createReadableStream(body),
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: brotliCompressSync(body).toString("base64"),
		headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
	});
});

test("It should encode string using gzip", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode stream using gzip", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: createReadableStream(body),
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "gzip",
	});
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
	});
});

test("It should encode string using deflate", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "deflate",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: deflateSync(body).toString("base64"),
		headers: { "Content-Encoding": "deflate", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode stream using deflate", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: createReadableStream(body),
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "deflate",
	});
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: deflateSync(body).toString("base64"),
		headers: { "Content-Encoding": "deflate", Vary: "Accept-Encoding" },
	});
});

test("It should encode using br when context.preferredEncoding is gzip, but has overridePreferredEncoding set", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body,
		headers: {
			Vary: "Something",
		},
	}));
	handler.use(
		httpContentEncoding({
			overridePreferredEncoding: ["br", "gzip", "deflate"],
		}),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "gzip",
		preferredEncodings: ["gzip", "deflate", "br"],
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: brotliCompressSync(body).toString("base64"),
		headers: { "Content-Encoding": "br", Vary: "Something, Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should not encode when missing context.preferredEncoding", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, context);

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when missing context.preferredEncoding === `identity`", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "identity",
		preferredEncodings: ["identity"],
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when response.isBase64Encoded is already set to true", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({
		statusCode: 200,
		body,
		isBase64Encoded: true,
	}));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body,
		headers: {},
		isBase64Encoded: true,
	});
});

test("It should not encode when response.body is not a string", async (t) => {
	const body = 0;
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when response.body is empty string", async (t) => {
	const body = "";
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when response.body is different type", async (t) => {
	const body = null;
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when response.body is undefined", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, { statusCode: 200, headers: {} });
});

test('It should not encode when response.headers["Cache-Control"] is `no-transform`', async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"Cache-Control": "no-transform",
		},
		body: "body",
	}));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Cache-Control": "no-transform" },
		body: "body",
	});
});

test('It should not encode when event.headers["Cache-Control"] is `no-transform`', async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,

		body: "body",
	}));
	handler.use(httpContentEncoding());

	const event = {
		headers: {
			"Cache-Control": "no-transform",
		},
	};

	const response = await handler(event, {
		...context,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Cache-Control": "no-transform" },
		body: "body",
	});
});

test("It should not encode when error is not handled", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("error");
	});
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(e.message, "error");
	}
});
