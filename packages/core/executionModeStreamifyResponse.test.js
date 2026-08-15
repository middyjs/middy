import { ok, strictEqual } from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { describe, test } from "node:test";
import {
	createPassThroughStream,
	createReadableStream,
	createWritableStream,
	pipejoin,
} from "@datastream/core";
import { executionModeStreamifyResponse } from "./executionModeStreamifyResponse.js";
import middy from "./index.js";

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

// Non-Promise thenable built via a computed key: a literal `then` property
// would trip lint/suspicious/noThenProperty, which should stay enabled to
// catch accidental thenables; these tests need one deliberately to assert
// middy never awaits it.
const thenKey = "then";
const createThenable = (onThen) => ({ [thenKey]: onThen });

// Scoped under a describe so the timer-mock beforeEach/afterEach register on
// this suite instead of the shared root. Under the node-test runner
// (isolation:"none") all core test files run in one process, where a
// root-level beforeEach runs before every test in every file: the fake
// timers would then break the durable runner's real-timer setup.
describe("executionModeStreamifyResponse", () => {
	test.beforeEach(async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	});
	test.afterEach(async (t) => {
		t.mock.reset();
	});

	// mock implementation awslambda.HttpResponseStream
	const DELIMITER_LEN = 8;
	globalThis.awslambda = {
		streamifyResponse: (cb) => cb,
		HttpResponseStream: {
			from: (underlyingStream, prelude) => {
				// https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/main/src/HttpResponseStream.js
				// Wrap the underlyingStream to ensure _onBeforeFirstWrite is called before the first write operation
				const wrapStream = () => {
					let isFirstWrite = true;
					const originalWrite = underlyingStream.write;
					underlyingStream.write = (...args) => {
						if (
							isFirstWrite &&
							typeof underlyingStream._onBeforeFirstWrite === "function"
						) {
							isFirstWrite = false;
							underlyingStream._onBeforeFirstWrite();
						}
						return originalWrite.apply(underlyingStream, args);
					};

					return underlyingStream;
				};

				// Execute _onBeforeFirstWrite before the first write operation
				underlyingStream._onBeforeFirstWrite = () => {
					const metadataPrelude = JSON.stringify(prelude);
					underlyingStream.write(metadataPrelude);
					underlyingStream.write(new Uint8Array(DELIMITER_LEN));
				};
				return wrapStream();
			},
		},
	};

	function createResponseStreamMockAndCapture() {
		function processChunkResponse(chunkResponse) {
			const indexOf = chunkResponse.indexOf(new Uint8Array(DELIMITER_LEN));
			const prelude = chunkResponse.slice(0, indexOf);
			const content = chunkResponse.slice(indexOf + DELIMITER_LEN * 2 - 1);
			return { prelude, content };
		}

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		return {
			responseStream,
			chunkResponse: () => chunkResponse,
			prelude: () => processChunkResponse(chunkResponse).prelude,
			content: () => processChunkResponse(chunkResponse).content,
		};
	}

	test("Should return with executionMode:executionModeStreamifyResponse using string", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler((event, context, { signal }) => {
			return input;
		});

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), input);
	});

	test("Should throw with executionMode:executionModeStreamifyResponse using object", async (t) => {
		const input = {};
		const handler = middy(
			(event, context, { signal }) => {
				return input;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const responseStream = createWritableStream((chunk) => {});
		try {
			await handler(event, responseStream, context);
		} catch (e) {
			strictEqual(
				e.message,
				"handler response not a Readable or ReadableStream",
			);
		}
	});

	test("Should return with executionMode:executionModeStreamifyResponse using body undefined", async (t) => {
		const input = "";
		const metadata = {
			statusCode: 200,
			headers: {
				"Content-Type": "plain/text",
			},
		};
		const handler = middy(
			(event, context, { signal }) => {
				return metadata;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, prelude, content } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(prelude(), JSON.stringify(metadata));
		strictEqual(content(), input);
	});

	test("Should flush empty body when handler returns null in streamify mode", async (t) => {
		const handler = middy(
			(event, context, { signal }) => {
				return null;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), "");
	});

	test("Should flush empty body when handler returns undefined in streamify mode", async (t) => {
		const handler = middy(
			(event, context, { signal }) => {
				return undefined;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), "");
	});

	test("Should flush empty body when before middleware short-circuits with earlyResponse=undefined in streamify mode", async (t) => {
		let requestEndCalled = false;
		const handler = middy(
			(event, context, { signal }) => {
				throw new Error("handler should not run");
			},
			{
				executionMode: executionModeStreamifyResponse,
				requestEnd: () => {
					requestEndCalled = true;
				},
			},
		).before((request) => {
			request.earlyResponse = undefined;
		});

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), "");
		ok(requestEndCalled);
	});

	test("Should return with executionMode:executionModeStreamifyResponse using body string", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler((event, context, { signal }) => {
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "plain/text",
				},
				body: input,
			};
		});

		const { responseStream, content } = createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(content(), input);
	});

	test("Should return with executionMode:executionModeStreamifyResponse using empty body string and prelude", async (t) => {
		const input = "";
		const metadata = {
			statusCode: 301,
			headers: {
				"Content-Type": "plain/text",
				Location: "https://example.com",
			},
		};

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler((event, context, { signal }) => {
			return {
				...metadata,
				body: input,
			};
		});

		const { responseStream, prelude, content } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);

		strictEqual(response, undefined);
		strictEqual(prelude(), JSON.stringify(metadata));
		strictEqual(content(), input);
	});

	test("Should flush prelude when body is an empty Node Readable stream", async (t) => {
		const metadata = {
			statusCode: 504,
			headers: {
				"Content-Type": "text/html",
			},
		};
		const handler = middy(
			async (event, context, { signal }) => {
				return {
					...metadata,
					body: Readable.from([]),
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, prelude, content } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(prelude(), JSON.stringify(metadata));
		strictEqual(content(), "");
	});

	test("Should flush prelude when body is an empty Web API ReadableStream", async (t) => {
		const metadata = {
			statusCode: 204,
			headers: {
				"Content-Type": "text/html",
			},
		};
		const handler = middy(
			async (event, context, { signal }) => {
				return {
					...metadata,
					body: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, prelude, content } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(prelude(), JSON.stringify(metadata));
		strictEqual(content(), "");
	});

	// https://nodejs.org/api/stream.html#readable-streams
	test("Should return with executionMode:executionModeStreamifyResponse using Node Readable stream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy(
			async (event, context, { signal }) => {
				return createReadableStream(input); // returns Readable stream
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), input);
	});

	// https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
	test("Should return with executionMode:executionModeStreamifyResponse using Web API ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy(
			async (event, context, { signal }) => {
				return new ReadableStream({
					async start(controller) {
						controller.enqueue(input);
						controller.close();
					},
				});
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), input);
	});

	test("Should return with executionMode:executionModeStreamifyResponse using body ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy(
			async (event, context, { signal }) => {
				return {
					statusCode: 200,
					headers: {
						"Content-Type": "plain/text",
					},
					body: createReadableStream(input),
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, content } = createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(content(), input);
	});

	test("Should return with executionMode:executionModeStreamifyResponse using ReadableStream.pipe(...)", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy(
			async (event, context, { signal }) => {
				return pipejoin([
					createReadableStream(input),
					createPassThroughStream(),
				]);
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), input);
	});

	test("Should return with executionMode:executionModeStreamifyResponse using body ReadableStream.pipe(...)", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const handler = middy(
			async (event, context, { signal }) => {
				return {
					statusCode: 200,
					headers: {
						"Content-Type": "plain/text",
					},
					body: pipejoin([
						createReadableStream(input),
						createPassThroughStream(),
					]),
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		);

		const { responseStream, content } = createResponseStreamMockAndCapture();
		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(content(), input);
	});

	test("Should honor backpressure when writing large string body", async (t) => {
		// 256KB body, 16KB chunks => at least 16 writes
		const input = "x".repeat(256 * 1024);
		const chunks = [];
		let pendingDrain = false;
		const writes = { count: 0, backpressureHits: 0 };

		const responseStream = new Writable({
			highWaterMark: 16 * 1024,
			write(chunk, encoding, callback) {
				writes.count += 1;
				chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
				// Simulate a slow consumer: defer callback so internal buffer fills
				// and write() returns false to the producer.
				setImmediate(callback);
			},
		});

		// Track when the producer actually had to wait for drain.
		const origWrite = responseStream.write.bind(responseStream);
		responseStream.write = (...args) => {
			const ok = origWrite(...args);
			if (!ok) writes.backpressureHits += 1;
			return ok;
		};
		responseStream.on("drain", () => {
			pendingDrain = false;
		});

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => input);

		await handler(event, responseStream, context);

		strictEqual(chunks.join(""), input, "all bytes delivered in order");
		ok(writes.count > 1, "body was chunked (got more than one write)");
		ok(
			writes.backpressureHits > 0,
			"producer observed backpressure (write returned false at least once)",
		);
		strictEqual(pendingDrain, false);
	});

	test("Should handle large string using stringIterator", async (t) => {
		// Create a string larger than stringIteratorSize (16384)
		const input = "x".repeat(20000);
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler((event, context, { signal }) => {
			return input;
		});

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), input);
	});

	test("Should throw error when handler returns invalid response type", async (t) => {
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler((event, context, { signal }) => {
			// Return an object without statusCode (not a stream or string)
			return { data: "test" };
		});

		const responseStream = createWritableStream((chunk) => {});
		try {
			await handler(event, responseStream, context);
		} catch (e) {
			strictEqual(
				e.message,
				"handler response not a Readable or ReadableStream",
			);
			strictEqual(e.cause.package, "@middy/core");
		}
	});

	test("Should allow replacing lambda handler using .handler() method", async (t) => {
		const input = "original handler";
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		})
			.handler((event, context, { signal }) => {
				return input;
			})
			.handler((event, context, { signal }) => {
				// Replace with new handler
				return "replaced handler";
			});

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		const response = await handler(event, responseStream, context);
		strictEqual(response, undefined);
		strictEqual(chunkResponse(), "replaced handler");
	});

	// plugin

	test("Should trigger requestStart hook", async (t) => {
		let startCalled = false;
		const input = "test";
		const handler = middy(
			async () => {
				return input;
			},
			{
				executionMode: executionModeStreamifyResponse,
				requestStart: () => {
					startCalled = true;
				},
			},
		);

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();

		await handler(event, responseStream, context);
		ok(startCalled);
		strictEqual(chunkResponse(), input);
	});

	test("Should propagate requestEnd hook error when handler succeeds in streamify mode", async (t) => {
		const hookErr = new Error("requestEnd failed");
		const handler = middy(async () => "ok", {
			executionMode: executionModeStreamifyResponse,
			requestEnd: () => {
				throw hookErr;
			},
		});

		const { responseStream } = createResponseStreamMockAndCapture();
		try {
			await handler(event, responseStream, context);
			throw new Error("Expected hook error to propagate");
		} catch (e) {
			strictEqual(e, hookErr);
		}
	});

	test("Should not await a thenable returned by requestEnd in streamify mode", async (t) => {
		// Real-Promises-only contract: only a real Promise from requestEnd is
		// awaited; a plain thenable is ignored, so its then() must never run.
		let thenAwaited = false;
		const handler = middy(async () => "ok", {
			executionMode: executionModeStreamifyResponse,
			requestEnd: () =>
				createThenable((resolve) => {
					thenAwaited = true;
					resolve();
				}),
		});

		const { responseStream, chunkResponse } =
			createResponseStreamMockAndCapture();
		await handler(event, responseStream, context);

		strictEqual(thenAwaited, false);
		strictEqual(chunkResponse(), "ok");
	});

	test("Should await async requestEnd hook and propagate its rejection in streamify mode", async (t) => {
		const hookErr = new Error("requestEnd failed");
		const handler = middy(async () => "ok", {
			executionMode: executionModeStreamifyResponse,
			requestEnd: async () => {
				throw hookErr;
			},
		});

		const { responseStream } = createResponseStreamMockAndCapture();
		try {
			await handler(event, responseStream, context);
			throw new Error("Expected hook error to propagate");
		} catch (e) {
			strictEqual(e, hookErr);
		}
	});

	test("Should preserve pipeline error when requestEnd hook also throws in streamify mode", async (t) => {
		const pipelineErr = new Error("pipeline failed");
		const hookErr = new Error("requestEnd failed");
		const handler = middy(
			async () => {
				const erroringStream = createReadableStream("x");
				// Force pipeline to fail by emitting an error after start
				process.nextTick(() => erroringStream.destroy(pipelineErr));
				return erroringStream;
			},
			{
				executionMode: executionModeStreamifyResponse,
				requestEnd: () => {
					throw hookErr;
				},
			},
		);

		const { responseStream } = createResponseStreamMockAndCapture();
		try {
			await handler(event, responseStream, context);
			throw new Error("Expected pipeline error to propagate");
		} catch (e) {
			strictEqual(e, pipelineErr);
			strictEqual(e.cause, hookErr);
		}
	});

	// L49 - invalid (non-stream, non-string) handler response must throw
	test("Should reject when handler response is neither string nor stream", async (t) => {
		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => {
			return { data: "not a stream" };
		});

		const responseStream = createWritableStream(() => {});
		let threw = false;
		try {
			await handler(event, responseStream, context);
		} catch (e) {
			threw = true;
			strictEqual(
				e.message,
				"handler response not a Readable or ReadableStream",
			);
			strictEqual(e.cause.package, "@middy/core");
		}
		ok(threw, "expected invalid handler response to throw");
	});

	// L90 - chunking loop writes exactly the right number of chunks, no overrun
	test("Should write exactly the expected chunk count for a multi-chunk body", async (t) => {
		const chunkSize = 16384;
		const input = "x".repeat(chunkSize * 3); // exactly 3 chunks
		const writes = [];
		const responseStream = new Writable({
			write(chunk, encoding, callback) {
				writes.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
				callback();
			},
		});

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => input);

		await handler(event, responseStream, context);

		strictEqual(writes.join(""), input, "all bytes delivered");
		// Exactly 3 chunks: an off-by-one over-iteration would add an empty write.
		strictEqual(writes.length, 3);
		ok(
			writes.every((c) => c.length > 0),
			"no empty (overrun) chunk written",
		);
	});

	// L94 - backpressure: the writer must await 'drain' between writes when the
	// stream buffer is full, and must NOT write again until drain fires.
	test("Should await drain between writes under backpressure (ordered)", async (t) => {
		t.mock.timers.reset(); // use real setImmediate for drain scheduling
		const chunkSize = 16384;
		const input = "x".repeat(chunkSize * 4);
		const sequence = [];

		const responseStream = new Writable({
			highWaterMark: 1, // force write() to always return false
			write(chunk, encoding, callback) {
				sequence.push("write");
				// Defer the callback so 'drain' is emitted asynchronously, giving the
				// producer something to await between chunks.
				setImmediate(callback);
			},
		});
		responseStream.on("drain", () => {
			sequence.push("drain");
		});

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => input);

		await handler(event, responseStream, context);

		// More than one body chunk was written.
		const writeCount = sequence.filter((s) => s === "write").length;
		ok(writeCount > 1, "body was chunked");

		// At least one drain occurred (backpressure honored).
		const drainCount = sequence.filter((s) => s === "drain").length;
		ok(drainCount > 0, "producer awaited at least one drain");

		// Crucially, the writes must not all be emitted before any drain. If drain
		// were never awaited, every 'write' would appear before the first 'drain'.
		const firstDrain = sequence.indexOf("drain");
		const lastWrite = sequence.lastIndexOf("write");
		ok(
			firstDrain < lastWrite,
			"a drain occurred between writes (writes were not all flushed before draining)",
		);
	});

	// L102 - a stream error during end() must reject the returned promise
	test("Should reject when the response stream errors on end", async (t) => {
		const streamErr = new Error("stream blew up");
		const responseStream = new Writable({
			write(chunk, encoding, callback) {
				callback();
			},
			final(callback) {
				// Fail on end(): callback with error emits 'error' on the stream.
				callback(streamErr);
			},
		});

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => "body");

		let caught;
		try {
			await handler(event, responseStream, context);
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, streamErr);
	});

	// L95 mutant #1 - ConditionalExpression `if (!ok && position < length)` -> `if (true)`.
	// When write() returns true (no backpressure) the real code must NOT await
	// 'drain'. The mutant awaits 'drain' after every write; with a stream that
	// returns true and never emits 'drain', the mutant hangs (times out) while the
	// real code completes. Body spans multiple chunks so the loop body runs > once.
	test("Should not await drain when writes succeed (no backpressure)", async (t) => {
		t.mock.timers.reset();
		const chunkSize = 16384;
		const input = "x".repeat(chunkSize * 3 + 7); // 4 chunks, last partial
		const written = [];

		let drainEmitted = false;
		const responseStream = new Writable({
			write(chunk, encoding, callback) {
				written.push(
					typeof chunk === "string" ? chunk : chunk.toString("utf8"),
				);
				callback();
			},
		});
		// Force every write() to report success (no backpressure) so the real code
		// never awaits drain. Guarantee no 'drain' is ever emitted: if the mutant
		// awaits drain it will hang and the test times out.
		const origWrite = responseStream.write.bind(responseStream);
		responseStream.write = (...args) => {
			origWrite(...args);
			return true;
		};
		responseStream.on("drain", () => {
			drainEmitted = true;
		});

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => input);

		await handler(event, responseStream, context);

		strictEqual(written.join(""), input, "all bytes delivered in order");
		ok(written.length > 1, "body was chunked across multiple writes");
		strictEqual(
			drainEmitted,
			false,
			"no drain was emitted, so a passing run proves drain was not awaited",
		);
	});

	// L95 mutant #2 - EqualityOperator `position < length` -> `position <= length`.
	// Body is an EXACT multiple of chunkSize, so after the final write
	// `position === length`. The final write reports backpressure (ok === false).
	// Real code: `!ok && position < length` => false, loop ends, no drain awaited.
	// Mutant: `!ok && position <= length` => true, awaits 'drain' after the final
	// write. We never emit 'drain' after the last write, so the mutant hangs.
	test("Should not await drain after the final exact-boundary chunk", async (t) => {
		t.mock.timers.reset();
		const chunkSize = 16384;
		const input = "x".repeat(chunkSize * 3); // exact multiple => final position === length
		const written = [];
		let writeCount = 0;
		let finalDrainAwaited = false;

		const responseStream = new Writable({
			write(chunk, encoding, callback) {
				written.push(
					typeof chunk === "string" ? chunk : chunk.toString("utf8"),
				);
				callback();
			},
		});

		const totalChunks = 3;
		const origWrite = responseStream.write.bind(responseStream);
		responseStream.write = (...args) => {
			writeCount += 1;
			origWrite(...args);
			// Report backpressure (false) on EVERY chunk, including the last. For all
			// but the last chunk emit a 'drain' so the real loop can proceed; after the
			// final chunk emit NO drain. The real code does not await drain on the final
			// chunk (position === length), so it completes. The `<=` mutant would await
			// the (never emitted) final drain and hang.
			if (writeCount < totalChunks) {
				setImmediate(() => responseStream.emit("drain"));
			} else {
				finalDrainAwaited = true;
			}
			return false;
		};

		const handler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(() => input);

		await handler(event, responseStream, context);

		strictEqual(written.join(""), input, "all bytes delivered in order");
		strictEqual(writeCount, totalChunks, "exact chunk count, no overrun");
		ok(finalDrainAwaited, "final chunk was written without emitting a drain");
	});

	test("Should trigger requestEnd hook after stream ends", async (t) => {
		const input = "x".repeat(1024 * 1024);
		let streamEnd = false;
		const handler = middy(
			async (event, context, { signal }) => {
				return pipejoin([
					createReadableStream(input),
					createPassThroughStream(
						() => {},
						() => {
							streamEnd = true;
						},
					),
				]);
			},
			{
				executionMode: executionModeStreamifyResponse,
				requestEnd: () => {
					strictEqual(streamEnd, true);
				},
			},
		);

		const { responseStream } = createResponseStreamMockAndCapture();
		await handler(event, responseStream, context);
	});
});
