import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import { describe, test } from "node:test";
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
import httpContentNegotiation from "../http-content-negotiation/index.js";
import httpContentEncoding, {
	httpContentEncodingValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Stands in for @middy/http-content-negotiation, republishing the preferred*
// values a test puts on the incoming context into context.middyContext, where
// the middleware reads them. Seeding context.middyContext directly would not
// work: @middy/core resets it on every invocation.
const seedPreferredEncoding = () => ({
	before: (request) => {
		const { preferredEncoding, preferredEncodings } = request.context;
		request.context.middyContext["http-content-negotiation"] = {
			preferredEncoding,
			preferredEncodings,
		};
	},
});

// The pairing under test in every case below. `.use()` accepts an array, so the
// stand-in stays out of the individual test bodies.
const contentEncodingStack = (options) => [
	seedPreferredEncoding(),
	httpContentEncoding(options),
];

const compressibleBody = JSON.stringify(new Array(100).fill(0));

describe("@middy/http-content-encoding", () => {
	test("It should encode string using br", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body })).use(
			contentEncodingStack(),
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
			contentEncodingStack({ br: brOptions }),
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
			contentEncodingStack({ gzip: gzipOptions }),
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
			contentEncodingStack({ br: brOptions }),
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
		})).use(contentEncodingStack());

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
			contentEncodingStack(),
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
		})).use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
			contentEncodingStack({
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
		handler.use(contentEncodingStack());

		const event = { headers: {} };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, { statusCode: 200, body, headers: {} });
	});

	test("It should not encode when missing context.preferredEncoding === `identity`", async (t) => {
		const body = "test";
		const handler = middy((event, context) => ({ statusCode: 200, body }));
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "br",
		});

		deepStrictEqual(response, { statusCode: 200, body, headers: {} });
	});

	test("It should not encode when response.body is undefined", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		}).use(contentEncodingStack());

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
			contentEncodingStack({
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
			contentEncodingStack({
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
			contentEncodingStack(),
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

		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
		handler.use(contentEncodingStack());

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
	// A source stream that fails must fail the encoded stream too. With .pipe()
	// the error was dropped: the encoder never ended (the response hung) and the
	// error surfaced as an uncaught exception.
	test("It should propagate a Node stream source error to the encoded stream", async (t) => {
		const source = new Readable({ read() {} });
		const handler = middy(() => ({ statusCode: 200, body: source })).use(
			contentEncodingStack(),
		);

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);
		source.push(compressibleBody);
		setImmediate(() => source.destroy(new Error("upstream failed")));

		await rejects(
			pipeline(response.body, new Writable({ write: (c, e, cb) => cb() })),
			{ message: "upstream failed" },
		);
	});

	test("It should propagate a Web stream source error to the encoded stream", async (t) => {
		let controller;
		const source = new ReadableStream({
			start(c) {
				controller = c;
			},
		});
		const handler = middy(() => ({ statusCode: 200, body: source })).use(
			contentEncodingStack(),
		);

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);
		controller.enqueue(new TextEncoder().encode(compressibleBody));
		setImmediate(() => controller.error(new Error("upstream failed")));

		await rejects(
			pipeline(response.body, new Writable({ write: (c, e, cb) => cb() })),
			{ message: "upstream failed" },
		);
	});

	// RFC 9110 8.6: Content-Length describes the unencoded body, so it goes.
	// RFC 9110 8.8.3: a strong validator must change with the content coding,
	// so a strong ETag is weakened; a weak one already allows it.
	test("It should drop Content-Length and weaken a strong ETag when it compresses", async (t) => {
		const body = compressibleBody;
		const handler = middy(() => ({
			statusCode: 200,
			body,
			headers: { "content-length": String(body.length), ETag: '"v1"' },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.headers["Content-Encoding"], "gzip");
		strictEqual(response.headers["content-length"], undefined);
		strictEqual(response.headers.ETag, 'W/"v1"');
	});

	test("It should keep a weak ETag as it is when it compresses a stream", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: createReadableStream(compressibleBody),
			headers: { "Content-Length": "401", etag: 'W/"v1"' },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.headers["Content-Length"], undefined);
		strictEqual(response.headers.etag, 'W/"v1"');
	});

	test("It should leave Content-Length and ETag when it does not compress", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: "x",
			headers: { "Content-Length": "1", ETag: '"v1"' },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.headers["Content-Length"], "1");
		strictEqual(response.headers.ETag, '"v1"');
	});

	// ALB with multi-value headers enabled reads and writes `multiValueHeaders`
	// only. https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
	test("It should respect Cache-Control no-transform in response multiValueHeaders", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: { "Cache-Control": ["no-transform"] },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.body, compressibleBody);
		strictEqual(response.isBase64Encoded, undefined);
	});

	test("It should not re-encode a body whose multiValueHeaders carry Content-Encoding", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: { "content-encoding": ["br"] },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.body, compressibleBody);
	});

	test("It should write the encoding headers to multiValueHeaders when the response uses them", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: {
				"Content-Type": ["application/json"],
				"Content-Length": [String(compressibleBody.length)],
				ETag: ['"v1"'],
			},
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		deepStrictEqual(response.multiValueHeaders, {
			"Content-Type": ["application/json"],
			ETag: ['W/"v1"'],
			"Content-Encoding": ["gzip"],
			Vary: ["Accept-Encoding"],
		});
		strictEqual(response.headers["Content-Encoding"], undefined);
		strictEqual(response.isBase64Encoded, true);
	});

	test("It should append Accept-Encoding to an existing multiValueHeaders Vary", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: { vary: ["Origin"] },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		deepStrictEqual(response.multiValueHeaders.vary, [
			"Origin",
			"Accept-Encoding",
		]);
	});

	test("It should honour a request no-transform sent in ALB multiValueHeaders", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: { "Content-Type": ["application/json"] },
		})).use(contentEncodingStack());

		const response = await handler(
			{ multiValueHeaders: { "cache-control": ["no-cache", "no-transform"] } },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.body, compressibleBody);
		deepStrictEqual(response.multiValueHeaders["Cache-Control"], [
			"no-transform",
		]);
	});

	// Field lines of a repeated header combine with a comma (RFC 9110 §5.3), so
	// the directives of one line never run into those of the next.
	test("It should not join multiValueHeaders Cache-Control lines into a no-transform directive", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			body: compressibleBody,
			multiValueHeaders: { "Cache-Control": ["no", "-transform"] },
		})).use(contentEncodingStack());

		const response = await handler(
			{ headers: {} },
			{ ...defaultContext, preferredEncoding: "gzip" },
		);

		strictEqual(response.isBase64Encoded, true);
		deepStrictEqual(response.multiValueHeaders["Content-Encoding"], ["gzip"]);
	});

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
			httpContentEncodingValidateOptions({
				overridePreferredEncoding: ["lz4"],
			});
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
			contentEncodingStack(),
		);

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "gzip",
			preferredEncodings: ["not-an-encoding"],
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
			contentEncodingStack(),
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
			contentEncodingStack(),
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
			contentEncodingStack(),
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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
		})).use(contentEncodingStack());

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
			contentEncodingStack(),
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
			contentEncodingStack(),
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
		}).use(contentEncodingStack());

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
		}).use(contentEncodingStack());

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
			context: {
				middyContext: {
					"http-content-negotiation": { preferredEncoding: "gzip" },
				},
			},
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

	test("It should not throw when context.middyContext is absent", async (t) => {
		// core seeds `context.middyContext` on every invocation, so only a direct
		// call reaches the `context.middyContext?.` short-circuit. Without a
		// negotiation namespace there is no preferredEncoding, so the body is left
		// untouched rather than throwing.
		const body = compressibleBody;
		const { after } = httpContentEncoding();
		const request = {
			event: {},
			context: {},
			response: { statusCode: 200, headers: {}, body },
		};

		await after(request);

		deepStrictEqual(request.response, {
			statusCode: 200,
			headers: {},
			body,
		});
	});

	test("It should not throw reading event Cache-Control when request.event is null", async (t) => {
		// null is a valid event value; `request.event?.headers` must short-circuit
		// rather than throwing on property access.
		const body = compressibleBody;
		const { after } = httpContentEncoding();
		const request = {
			event: null,
			context: {
				middyContext: {
					"http-content-negotiation": { preferredEncoding: "gzip" },
				},
			},
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

	// Paired with the real @middy/http-content-negotiation, which is the only way
	// preferredEncoding is produced in practice. Every other test in this file
	// stands in for it, so a mismatch between where negotiation publishes and where
	// this middleware reads is invisible to them.
	test("It should encode when paired with @middy/http-content-negotiation", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body }))
			.use(httpContentNegotiation())
			.use(httpContentEncoding());

		const event = { headers: { "accept-encoding": "br" } };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			body: brotliCompressSync(body).toString("base64"),
			headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
			isBase64Encoded: true,
		});
	});

	test("httpContentEncodingValidateOptions validates contextKeyHttpContentNegotiation as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		httpContentEncodingValidateOptions({
			contextKeyHttpContentNegotiation: "custom",
		});
		try {
			httpContentEncodingValidateOptions({
				contextKeyHttpContentNegotiation: 123,
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKeyHttpContentNegotiation"));
		}
	});

	// `{ [encoding]: false }` disables that encoder. Negotiation then falls through
	// to the client's next acceptable encoding, or leaves the body unencoded.
	test("It should not encode when the negotiated encoding is disabled with `false`", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body }))
			.use(httpContentNegotiation())
			.use(httpContentEncoding({ gzip: false }));

		const event = { headers: { "accept-encoding": "gzip" } };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, { statusCode: 200, body, headers: {} });
	});

	test("It should fall through to the next acceptable encoding when the negotiated one is disabled", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body }))
			.use(httpContentNegotiation())
			.use(httpContentEncoding({ gzip: false }));

		const event = { headers: { "accept-encoding": "gzip, br" } };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			body: brotliCompressSync(body).toString("base64"),
			headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
			isBase64Encoded: true,
		});
	});

	test("It should keep the negotiated encoding when only another encoding is disabled", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body })).use(
			contentEncodingStack({ gzip: false }),
		);

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "br",
			preferredEncodings: ["br", "gzip"],
		});

		deepStrictEqual(response, {
			statusCode: 200,
			body: brotliCompressSync(body).toString("base64"),
			headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
			isBase64Encoded: true,
		});
	});

	test("It should not encode when the negotiated encoding is disabled and no alternatives were negotiated", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body })).use(
			contentEncodingStack({ gzip: false }),
		);

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "gzip",
			preferredEncodings: undefined,
		});

		deepStrictEqual(response, { statusCode: 200, body, headers: {} });
	});

	test("It should skip a disabled encoding listed in overridePreferredEncoding", async (t) => {
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body })).use(
			contentEncodingStack({
				gzip: false,
				overridePreferredEncoding: ["gzip", "br"],
			}),
		);

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "deflate",
			preferredEncodings: ["deflate", "gzip", "br"],
		});

		deepStrictEqual(response, {
			statusCode: 200,
			body: brotliCompressSync(body).toString("base64"),
			headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
			isBase64Encoded: true,
		});
	});

	test("It should keep an enabled negotiated encoding when another is disabled and no alternatives were negotiated", async (t) => {
		// Only a disabled `preferredEncoding` is replaced by the next negotiated
		// one. An enabled one stays as it is, even with no list to fall back on.
		const body = compressibleBody;
		const handler = middy((event, context) => ({ statusCode: 200, body })).use(
			contentEncodingStack({ gzip: false }),
		);

		const event = { headers: {} };

		const response = await handler(event, {
			...defaultContext,
			preferredEncoding: "br",
			preferredEncodings: undefined,
		});

		deepStrictEqual(response, {
			statusCode: 200,
			body: brotliCompressSync(body).toString("base64"),
			headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" },
			isBase64Encoded: true,
		});
	});

	const binaryValues = () => [
		Buffer.from("dictionary"),
		new ArrayBuffer(8),
		new DataView(new ArrayBuffer(8)),
		new Int8Array(1),
		new Uint8Array(1),
		new Uint8ClampedArray(1),
		new Int16Array(1),
		new Uint16Array(1),
		new Int32Array(1),
		new Uint32Array(1),
		new Float16Array(1),
		new Float32Array(1),
		new Float64Array(1),
		new BigInt64Array(1),
		new BigUint64Array(1),
	];

	const zlibOptions = {
		flush: constants.Z_SYNC_FLUSH,
		finishFlush: constants.Z_FINISH,
		chunkSize: 32 * 1024,
		windowBits: 15,
		level: 9,
		memLevel: 8,
		strategy: constants.Z_RLE,
		dictionary: Buffer.from("dictionary"),
		info: false,
		maxOutputLength: 1024,
		rejectGarbageAfterEnd: false,
	};

	const brotliOptions = {
		flush: constants.BROTLI_OPERATION_FLUSH,
		finishFlush: constants.BROTLI_OPERATION_FINISH,
		chunkSize: 32 * 1024,
		params: {
			[constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
			[constants.BROTLI_PARAM_QUALITY]: 7,
			[constants.BROTLI_PARAM_LGWIN]: 24,
			[constants.BROTLI_PARAM_LGBLOCK]: 20,
			[constants.BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING]: true,
			[constants.BROTLI_PARAM_SIZE_HINT]: 4096,
			[constants.BROTLI_PARAM_LARGE_WINDOW]: 1,
			[constants.BROTLI_PARAM_NPOSTFIX]: 3,
			[constants.BROTLI_PARAM_NDIRECT]: 120,
		},
		maxOutputLength: 1024,
		info: false,
		rejectGarbageAfterEnd: false,
	};

	const zstdOptions = {
		flush: constants.ZSTD_e_flush,
		finishFlush: constants.ZSTD_e_end,
		chunkSize: 32 * 1024,
		params: {
			[constants.ZSTD_c_compressionLevel]: -5,
			[constants.ZSTD_c_windowLog]: 20,
			[constants.ZSTD_c_hashLog]: 20,
			[constants.ZSTD_c_chainLog]: 20,
			[constants.ZSTD_c_searchLog]: 5,
			[constants.ZSTD_c_minMatch]: 4,
			[constants.ZSTD_c_targetLength]: 16,
			[constants.ZSTD_c_strategy]: 5,
			[constants.ZSTD_c_enableLongDistanceMatching]: true,
			[constants.ZSTD_c_ldmHashLog]: 20,
			[constants.ZSTD_c_ldmMinMatch]: 64,
			[constants.ZSTD_c_ldmBucketSizeLog]: 3,
			[constants.ZSTD_c_ldmHashRateLog]: 7,
			[constants.ZSTD_c_contentSizeFlag]: 1,
			[constants.ZSTD_c_checksumFlag]: true,
			[constants.ZSTD_c_dictIDFlag]: false,
			[constants.ZSTD_c_nbWorkers]: 0,
			[constants.ZSTD_c_jobSize]: 0,
			[constants.ZSTD_c_overlapLog]: 0,
		},
		pledgedSrcSize: 0,
		maxOutputLength: 1024,
		info: false,
		dictionary: Buffer.from("dictionary"),
		rejectGarbageAfterEnd: false,
	};

	test("httpContentEncodingValidateOptions accepts the documented br options", () => {
		httpContentEncodingValidateOptions({
			br: {
				params: {
					[constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
					[constants.BROTLI_PARAM_QUALITY]: 7,
				},
			},
			overridePreferredEncoding: ["br", "gzip", "deflate"],
		});
		httpContentEncodingValidateOptions({ br: true, gzip: false });
	});

	test("httpContentEncodingValidateOptions accepts every key of the Node.js zlib option classes", () => {
		httpContentEncodingValidateOptions({
			gzip: zlibOptions,
			deflate: zlibOptions,
			br: brotliOptions,
			zstd: zstdOptions,
		});
	});

	test("httpContentEncodingValidateOptions accepts every documented dictionary type", () => {
		for (const dictionary of binaryValues()) {
			httpContentEncodingValidateOptions({
				gzip: { dictionary },
				deflate: { dictionary },
				zstd: { dictionary },
			});
		}
	});

	const rejectsEncoder = (encoding, value) =>
		throws(
			() => httpContentEncodingValidateOptions({ [encoding]: value }),
			{
				name: "TypeError",
				message: `Option '${encoding}' must match exactly one schema in oneOf`,
			},
			`${encoding}: ${JSON.stringify(value)}`,
		);

	test("httpContentEncodingValidateOptions rejects gzip and deflate options outside zlib Options", () => {
		for (const encoding of ["gzip", "deflate"]) {
			for (const value of [
				"fast",
				{ params: {} },
				{ pledgedSrcSize: 1 },
				{ levle: 9 },
				{ flush: constants.Z_BLOCK + 1 },
				{ finishFlush: constants.Z_NO_FLUSH - 1 },
				{ chunkSize: constants.Z_MIN_CHUNK - 1 },
				{ chunkSize: 1024.5 },
				{ windowBits: constants.Z_MIN_WINDOWBITS - 1 },
				{ windowBits: constants.Z_MAX_WINDOWBITS + 1 },
				{ level: constants.Z_MIN_LEVEL - 1 },
				{ level: constants.Z_MAX_LEVEL + 1 },
				{ memLevel: constants.Z_MIN_MEMLEVEL - 1 },
				{ memLevel: constants.Z_MAX_MEMLEVEL + 1 },
				{ strategy: constants.Z_DEFAULT_STRATEGY - 1 },
				{ strategy: constants.Z_FIXED + 1 },
				{ dictionary: "dictionary" },
				{ dictionary: [1, 2] },
				{ info: "yes" },
				{ maxOutputLength: 0 },
				{ maxOutputLength: Number.MAX_SAFE_INTEGER + 2 },
				{ rejectGarbageAfterEnd: 1 },
			]) {
				rejectsEncoder(encoding, value);
			}
		}
	});

	test("httpContentEncodingValidateOptions rejects br options outside BrotliOptions", () => {
		const param = (key, value) => ({ params: { [key]: value } });
		for (const value of [
			{ level: 9 },
			{ dictionary: Buffer.from("dictionary") },
			{ pledgedSrcSize: 1 },
			{ flush: constants.BROTLI_OPERATION_EMIT_METADATA + 1 },
			{ finishFlush: constants.BROTLI_OPERATION_PROCESS - 1 },
			{ chunkSize: constants.Z_MIN_CHUNK - 1 },
			{ maxOutputLength: 0 },
			{ info: 1 },
			{ rejectGarbageAfterEnd: "no" },
			{ params: { 9: 1 } },
			param(constants.BROTLI_PARAM_MODE, 3),
			param(constants.BROTLI_PARAM_QUALITY, constants.BROTLI_MIN_QUALITY - 1),
			param(constants.BROTLI_PARAM_QUALITY, constants.BROTLI_MAX_QUALITY + 1),
			param(constants.BROTLI_PARAM_QUALITY, true),
			param(constants.BROTLI_PARAM_LGWIN, constants.BROTLI_MIN_WINDOW_BITS - 1),
			param(
				constants.BROTLI_PARAM_LGWIN,
				constants.BROTLI_LARGE_MAX_WINDOW_BITS + 1,
			),
			param(
				constants.BROTLI_PARAM_LGBLOCK,
				constants.BROTLI_MIN_INPUT_BLOCK_BITS - 1,
			),
			param(
				constants.BROTLI_PARAM_LGBLOCK,
				constants.BROTLI_MAX_INPUT_BLOCK_BITS + 1,
			),
			param(constants.BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING, 2),
			param(constants.BROTLI_PARAM_SIZE_HINT, -1),
			param(constants.BROTLI_PARAM_SIZE_HINT, 2 ** 32),
			param(constants.BROTLI_PARAM_LARGE_WINDOW, "yes"),
			param(constants.BROTLI_PARAM_NPOSTFIX, -1),
			param(constants.BROTLI_PARAM_NPOSTFIX, 4),
			param(constants.BROTLI_PARAM_NDIRECT, -1),
			param(constants.BROTLI_PARAM_NDIRECT, 121),
		]) {
			rejectsEncoder("br", value);
		}
	});

	test("httpContentEncodingValidateOptions rejects zstd options outside ZstdOptions", () => {
		const param = (key, value) => ({ params: { [key]: value } });
		for (const value of [
			{ level: 9 },
			{ flush: constants.ZSTD_e_end + 1 },
			{ finishFlush: constants.ZSTD_e_continue - 1 },
			{ chunkSize: constants.Z_MIN_CHUNK - 1 },
			{ maxOutputLength: 0 },
			{ info: 1 },
			{ rejectGarbageAfterEnd: "no" },
			{ dictionary: "dictionary" },
			{ pledgedSrcSize: -1 },
			{ pledgedSrcSize: Number.MAX_SAFE_INTEGER + 2 },
			{ params: { 99: 1 } },
			param(constants.ZSTD_c_compressionLevel, 2 ** 31),
			param(constants.ZSTD_c_compressionLevel, -(2 ** 31) - 1),
			param(constants.ZSTD_c_compressionLevel, "3"),
		]) {
			rejectsEncoder("zstd", value);
		}
	});

	test("httpContentEncodingValidateOptions caps overridePreferredEncoding at the four distinct encodings", () => {
		throws(
			() =>
				httpContentEncodingValidateOptions({
					overridePreferredEncoding: ["br", "br"],
				}),
			{
				name: "TypeError",
				message: "Duplicate item at 'overridePreferredEncoding[1]'",
			},
		);
		throws(
			() =>
				httpContentEncodingValidateOptions({
					overridePreferredEncoding: ["br", "deflate", "gzip", "zstd", "br"],
				}),
			{
				name: "TypeError",
				message: "Option 'overridePreferredEncoding' must have <= 4 items",
			},
		);
	});

	test("httpContentEncodingValidateOptions bounds contextKeyHttpContentNegotiation to a 1024 character key name", () => {
		httpContentEncodingValidateOptions({
			contextKeyHttpContentNegotiation: "k".repeat(1024),
		});
		throws(
			() =>
				httpContentEncodingValidateOptions({
					contextKeyHttpContentNegotiation: "k".repeat(1025),
				}),
			{
				name: "TypeError",
				message:
					"Option 'contextKeyHttpContentNegotiation' must have length <= 1024",
			},
		);
		throws(
			() =>
				httpContentEncodingValidateOptions({
					contextKeyHttpContentNegotiation: "a b",
				}),
			{
				name: "TypeError",
				message:
					/^Option 'contextKeyHttpContentNegotiation' must match pattern /,
			},
		);
	});

	test("httpContentEncodingValidateOptions accepts any visible ASCII contextKeyHttpContentNegotiation", () => {
		httpContentEncodingValidateOptions({
			contextKeyHttpContentNegotiation: "@middy/x",
		});
		throws(
			() =>
				httpContentEncodingValidateOptions({
					contextKeyHttpContentNegotiation: "",
				}),
			{
				name: "TypeError",
				message:
					/^Option 'contextKeyHttpContentNegotiation' must match pattern /,
			},
		);
	});
});
