import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { ReadableStream } from "node:stream/web";
import { test } from "node:test";
import {
	brotliCompressSync,
	constants,
	deflateSync,
	gunzipSync,
	gzipSync,
	zstdDecompressSync,
} from "node:zlib";
import { createReadableStream, streamToBuffer } from "@datastream/core";
import middy from "../core/index.js";
import httpContentEncoding, {
	httpContentEncodingValidateOptions,
} from "./index.js";

const defaultContext = {
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
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: brotliCompressSync(body).toString("base64"),
		headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should pass br options to sync encoder for string body", async (t) => {
	const body = compressibleBody;
	const brOptions = {
		params: { [constants.BROTLI_PARAM_QUALITY]: 3 },
	};
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding({ br: brOptions }),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	const expected = brotliCompressSync(body, brOptions).toString("base64");
	strictEqual(response.body, expected);
	// Sanity: with quality=3 the output differs from default quality=11,
	// so this assertion would have caught the dropped-options bug.
	ok(response.body !== brotliCompressSync(body).toString("base64"));
});

test("It should pass gzip options to sync encoder for string body", async (t) => {
	const body = compressibleBody;
	const gzipOptions = { level: 1 };
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding({ gzip: gzipOptions }),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	const expected = gzipSync(body, gzipOptions).toString("base64");
	strictEqual(response.body, expected);
	ok(response.body !== gzipSync(body).toString("base64"));
});

test("It should pass br options to sync encoder for Buffer body", async (t) => {
	const body = Buffer.from(compressibleBody);
	const brOptions = {
		params: { [constants.BROTLI_PARAM_QUALITY]: 3 },
	};
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding({ br: brOptions }),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	const expected = brotliCompressSync(body, brOptions).toString("base64");
	strictEqual(response.body, expected);
});

test("It should encode stream using br", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: createReadableStream(body),
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when missing context.preferredEncoding === `identity`", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({ statusCode: 200, body }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when response.body is undefined", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));
	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
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
		...defaultContext,
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
		...defaultContext,
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
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "error");
	}
});

test("It should export getContentEncodingStream helper function", async (t) => {
	const { getContentEncodingStream } = await import("./index.js");
	const stream = getContentEncodingStream("gzip");
	ok(stream);
	strictEqual(typeof stream.pipe, "function");
});

test("It should pass options to getContentEncodingStream encoder", async (t) => {
	const { getContentEncodingStream } = await import("./index.js");
	const body = compressibleBody;

	const stream = getContentEncodingStream("gzip", { level: 1 });
	stream.end(body);
	const compressed = await streamToBuffer(stream);

	// Roundtrips back to the original body.
	strictEqual(gunzipSync(compressed).toString(), body);
	// With level=1 the output differs from the default (level=6) stream,
	// so this would have caught the dropped-options bug.
	const defaultStream = getContentEncodingStream("gzip");
	defaultStream.end(body);
	const defaultCompressed = await streamToBuffer(defaultStream);
	ok(!compressed.equals(defaultCompressed));
});

test("It should handle errors in onError middleware when response is defined", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("test error");
	}).use(httpContentEncoding());

	handler.onError(async (request) => {
		request.response = {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "test" }),
		};
	});

	const event = {
		headers: {
			"Accept-Encoding": "gzip",
		},
	};

	const response = await handler(event, defaultContext);
	ok(response);
	strictEqual(response.statusCode, 500);
});

test("It should skip override encodings not in preferredEncodings", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body,
	}));
	handler.use(
		httpContentEncoding({
			// Try to override with br and zstd, but only gzip is in preferredEncodings
			overridePreferredEncoding: ["br", "zstd", "gzip"],
		}),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "deflate",
		preferredEncodings: ["deflate", "gzip"], // Only deflate and gzip supported
	});

	// Should use gzip since br and zstd are not in preferredEncodings
	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should not throw when overridePreferredEncoding is set but context.preferredEncodings is undefined", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body,
	}));
	handler.use(
		httpContentEncoding({
			overridePreferredEncoding: ["br", "gzip", "deflate"],
		}),
	);

	const event = { headers: {} };

	// preferredEncoding present, but preferredEncodings intentionally omitted.
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	// No override applies (no preferredEncodings list), so it falls back to the
	// context preferredEncoding (gzip) without throwing.
	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode Buffer body", async (t) => {
	const body = Buffer.from(compressibleBody);
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should not encode when compressed body is larger than original", async (t) => {
	// Very short body - compression overhead makes it larger
	const body = "x";
	const handler = middy((event, context) => {
		return {
			statusCode: 200,
			body,
		};
	});

	handler.use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
		preferredEncodings: ["gzip"],
	});

	// Should not encode because compressed is larger
	deepStrictEqual(response, {
		statusCode: 200,
		body: "x",
		headers: {},
	});
});

test("It should append no-transform when event has Cache-Control: no-transform and response already has Cache-Control", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"Cache-Control": "max-age=3600",
		},
		body: "body",
	}));
	handler.use(httpContentEncoding());

	const event = {
		headers: {
			"Cache-Control": "no-transform",
		},
	};

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Cache-Control": "max-age=3600, no-transform" },
		body: "body",
	});
});

test("It should handle lowercase cache-control in event headers", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: "body",
	}));
	handler.use(httpContentEncoding());

	const event = {
		headers: {
			"cache-control": "no-transform",
		},
	};

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Cache-Control": "no-transform" },
		body: "body",
	});
});

test("It should handle lowercase cache-control header when appending no-transform", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"cache-control": "max-age=3600",
		},
		body: "body",
	}));
	handler.use(httpContentEncoding());

	const event = {
		headers: {
			"Cache-Control": "no-transform",
		},
	};

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "cache-control": "max-age=3600, no-transform" },
		body: "body",
	});
});

// Web API ReadableStream tests
test("It should encode Web API ReadableStream using br", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});
	ok(response.body instanceof ReadableStream);
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: brotliCompressSync(body).toString("base64"),
		headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
	});
});

test("It should encode Web API ReadableStream using gzip", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});
	ok(response.body instanceof ReadableStream);
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
	});
});

test("It should encode Web API ReadableStream using deflate", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "deflate",
	});
	ok(response.body instanceof ReadableStream);
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString("base64");
	deepStrictEqual(response, {
		statusCode: 200,
		body: deflateSync(body).toString("base64"),
		headers: { "Content-Encoding": "deflate", Vary: "Accept-Encoding" },
	});
});

test("It should encode Web API ReadableStream using zstd", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "zstd",
	});
	ok(response.body instanceof ReadableStream);
	const compressed = await streamToBuffer(response.body);
	const decompressed = zstdDecompressSync(compressed).toString();
	deepStrictEqual(response.statusCode, 200);
	deepStrictEqual(response.headers, {
		"Content-Encoding": "zstd",
		Vary: "Accept-Encoding",
	});
	deepStrictEqual(decompressed, body);
});

test("It should not encode Web API ReadableStream when missing preferredEncoding", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, defaultContext);
	ok(response.body instanceof ReadableStream);
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString();
	deepStrictEqual(response, {
		statusCode: 200,
		body,
		headers: {},
	});
});

test("It should not encode Web API ReadableStream when response.isBase64Encoded is true", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
		isBase64Encoded: true,
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});
	ok(response.body instanceof ReadableStream);
	deepStrictEqual(response.statusCode, 200);
	deepStrictEqual(response.headers, {});
	deepStrictEqual(response.isBase64Encoded, true);
});

test("It should not encode Web API ReadableStream when response Cache-Control is no-transform", async (t) => {
	const body = "test";
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Cache-Control": "no-transform" },
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(body);
				controller.close();
			},
		}),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});
	ok(response.body instanceof ReadableStream);
	response.body = await streamToBuffer(response.body);
	response.body = response.body.toString();
	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Cache-Control": "no-transform" },
		body,
	});
});

test("It should encode Node.js stream using zstd", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		body: createReadableStream(body),
	})).use(httpContentEncoding());

	const event = { headers: {} };
	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "zstd",
	});
	const compressed = await streamToBuffer(response.body);
	const decompressed = zstdDecompressSync(compressed).toString();
	deepStrictEqual(response.statusCode, 200);
	deepStrictEqual(response.headers, {
		"Content-Encoding": "zstd",
		Vary: "Accept-Encoding",
	});
	deepStrictEqual(decompressed, body);
});

test("httpContentEncodingValidateOptions accepts valid options and rejects typos", () => {
	httpContentEncodingValidateOptions({
		br: {},
		gzip: { level: 9 },
		overridePreferredEncoding: ["br"],
	});
	httpContentEncodingValidateOptions({});
	try {
		httpContentEncodingValidateOptions({ gzpi: {} });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-content-encoding");
	}
});

test("httpContentEncodingValidateOptions rejects wrong type", () => {
	try {
		httpContentEncodingValidateOptions({ overridePreferredEncoding: "br" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("overridePreferredEncoding"));
	}
});

test("httpContentEncodingValidateOptions accepts each supported override encoding", () => {
	// Each enum member must remain valid: blanking any of them in the schema
	// would cause the matching value to be rejected here.
	for (const enc of ["br", "deflate", "gzip", "zstd"]) {
		httpContentEncodingValidateOptions({ overridePreferredEncoding: [enc] });
	}
});

test("httpContentEncodingValidateOptions rejects unknown override encoding", () => {
	try {
		httpContentEncodingValidateOptions({ overridePreferredEncoding: ["lz4"] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-content-encoding");
	}
});

test("It should not apply override when overridePreferredEncoding default is empty", async (t) => {
	// With the default empty overridePreferredEncoding, the override loop never
	// runs, so even a preferredEncodings list containing a non-encoding value is
	// ignored and the context preferredEncoding (gzip) is used as-is.
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
		preferredEncodings: ["Stryker was here"],
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode when event has no headers property", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	// No `headers` key at all: the optional chaining on event.headers must not throw.
	const event = {};

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode when event itself is undefined", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	// Undefined event: optional chaining on event must not throw.
	const response = await handler(undefined, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should not add Cache-Control when event Cache-Control is not no-transform", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = {
		headers: {
			"Cache-Control": "max-age=3600",
		},
	};

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	// max-age is not no-transform, so no Cache-Control header should be injected
	// and the body should still be encoded.
	deepStrictEqual(response, {
		statusCode: 200,
		body: gzipSync(body).toString("base64"),
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		isBase64Encoded: true,
	});
});

test("It should encode when response Cache-Control is set but not no-transform", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Cache-Control": "max-age=3600" },
		body,
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	// A non-no-transform Cache-Control must not block encoding.
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Cache-Control": "max-age=3600",
			"Content-Encoding": "gzip",
			Vary: "Accept-Encoding",
		},
		body: gzipSync(body).toString("base64"),
		isBase64Encoded: true,
	});
});

test("It should not encode when response lowercase cache-control is no-transform", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "cache-control": "no-transform" },
		body,
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "cache-control": "no-transform" },
		body,
	});
});

test("It should not re-encode when response already has Content-Encoding header", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Content-Encoding": "gzip" },
		body,
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "Content-Encoding": "gzip" },
		body,
	});
});

test("It should not re-encode when response already has lowercase content-encoding header", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "content-encoding": "gzip" },
		body,
	})).use(httpContentEncoding());

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "br",
	});

	deepStrictEqual(response, {
		statusCode: 200,
		headers: { "content-encoding": "gzip" },
		body,
	});
});

test("It should not encode when response.body is a non-empty number", async (t) => {
	// A truthy, non-string/non-buffer/non-stream body must be skipped by the
	// body-type guard rather than being coerced and compressed.
	const body = 42;
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should not encode when compressed length equals input length", async (t) => {
	// Deterministic body whose gzip output length is exactly equal to the input
	// length (32 bytes). Encoding is only applied when strictly smaller, so this
	// must be left untouched.
	const body = `${"a".repeat(23)}bcdefghij`;
	strictEqual(gzipSync(body).length, Buffer.byteLength(body));
	const handler = middy((event, context) => ({ statusCode: 200, body })).use(
		httpContentEncoding(),
	);

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, { statusCode: 200, body, headers: {} });
});

test("It should encode the error response set during onError", async (t) => {
	const body = compressibleBody;
	const handler = middy((event, context) => {
		throw new Error("boom");
	}).use(httpContentEncoding());

	handler.onError(async (request) => {
		request.response = { statusCode: 500, headers: {}, body };
	});

	const event = { headers: {} };

	const response = await handler(event, {
		...defaultContext,
		preferredEncoding: "gzip",
	});

	deepStrictEqual(response, {
		statusCode: 500,
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		body: gzipSync(body).toString("base64"),
		isBase64Encoded: true,
	});
});

test("It should not handle onError when response is undefined and rethrow", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("boom");
	}).use(httpContentEncoding());

	const event = { headers: {} };

	let thrown;
	try {
		await handler(event, {
			...defaultContext,
			preferredEncoding: "gzip",
		});
	} catch (e) {
		thrown = e;
	}
	ok(thrown instanceof Error);
	strictEqual(thrown.message, "boom");
});

test("It should not throw reading event Cache-Control when request.event is undefined", async (t) => {
	// Invoke the middleware's after handler directly with request.event === undefined
	// (middy() defaults a missing event to {}, so only a direct call exercises the
	// `request.event?.` optional chaining). The handler must read cache-control
	// without throwing and still encode the body.
	const body = compressibleBody;
	const { after } = httpContentEncoding();
	const request = {
		event: undefined,
		context: { preferredEncoding: "gzip" },
		response: { statusCode: 200, headers: {}, body },
	};

	await after(request);

	deepStrictEqual(request.response, {
		statusCode: 200,
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		body: gzipSync(body).toString("base64"),
		isBase64Encoded: true,
	});
});

test("It should not throw reading event Cache-Control when request.event is null", async (t) => {
	// null is a valid event value; `request.event?.headers` must short-circuit
	// rather than throwing on property access.
	const body = compressibleBody;
	const { after } = httpContentEncoding();
	const request = {
		event: null,
		context: { preferredEncoding: "gzip" },
		response: { statusCode: 200, headers: {}, body },
	};

	await after(request);

	deepStrictEqual(request.response, {
		statusCode: 200,
		headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
		body: gzipSync(body).toString("base64"),
		isBase64Encoded: true,
	});
});
