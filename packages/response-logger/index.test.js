import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { constants as bufferConstants } from "node:buffer";
import { Readable } from "node:stream";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { createReadableStream, createWritableStream } from "@datastream/core";
import { executionModeStreamifyResponse } from "../core/executionModeStreamifyResponse.js";
import middy from "../core/index.js";
import responseLogger, { responseLoggerValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

globalThis.awslambda = {
	streamifyResponse: (cb) => cb,
	HttpResponseStream: {
		from: (responseStream, metadata) => {
			return responseStream;
		},
	},
};

const thenKey = "then";

describe("@middy/response-logger", () => {
	test("It should log the response", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(responseLogger({ logger }));

		const event = { foo: "bar", fuu: "baz" };
		const response = await handler(event, defaultContext);

		strictEqual(logger.mock.callCount(), 1);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, event);
		deepStrictEqual(response, event);
	});

	test("It should hand the logger the whole request", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(responseLogger({ logger }));

		const event = { foo: "bar" };
		await handler(event, defaultContext);

		const [request] = logger.mock.calls[0].arguments;
		strictEqual(request.event, event);
		strictEqual(request.context, defaultContext);
		ok("internal" in request);
	});

	test("It should use the default logger when none is provided", async (t) => {
		const originalLog = console.log;
		const logCalls = [];
		console.log = (message) => {
			logCalls.push(message);
		};

		const handler = middy((event) => event).use(responseLogger());

		const event = { foo: "bar" };
		const response = await handler(event, defaultContext);

		console.log = originalLog;

		strictEqual(logCalls.length, 1);
		deepStrictEqual(JSON.parse(logCalls[0]), { response: event });
		deepStrictEqual(response, event);
	});

	// `{ ...defaults, ...opts }` lets an explicit `logger: undefined` override the
	// default; it means "not set", not "off", so the default logger must be kept.
	test("It should use the default logger when logger is explicitly undefined", async (t) => {
		const log = t.mock.method(console, "log", () => {});

		const handler = middy((event) => event).use(
			responseLogger({ logger: undefined }),
		);

		const event = { foo: "bar" };
		deepStrictEqual(await handler(event, defaultContext), event);

		strictEqual(log.mock.callCount(), 1);
		deepStrictEqual(JSON.parse(log.mock.calls[0].arguments[0]), {
			response: event,
		});
	});

	// Logging is this middleware's only job, so there is no "off" setting: the
	// way to disable it is to not register the middleware.
	test("It should reject logger: false at construction", () => {
		for (const logger of [false, null]) {
			// The factory says what to do instead; the validator keeps the generic
			// option wording every other option uses.
			throws(() => responseLogger({ logger }), {
				name: "TypeError",
				message:
					"Option 'logger' must be a function; @middy/response-logger only logs, omit the middleware to disable logging",
				cause: { package: "@middy/response-logger" },
			});
			throws(() => responseLoggerValidateOptions({ logger }), {
				name: "TypeError",
				message: "Option 'logger' must be instanceof Function",
				cause: { package: "@middy/response-logger" },
			});
		}
	});

	// winston's `logger.info()` returns the logger; a hook that forwarded it would
	// make core treat it as an early response and replace the real one.
	test("It should ignore the logger's return value after the handler", async (t) => {
		const handler = middy(() => "handler").use(
			responseLogger({ logger: () => ({ chained: true }) }),
		);

		strictEqual(await handler({ foo: "bar" }, defaultContext), "handler");
	});

	test("It should ignore the logger's return value when an error is handled", async (t) => {
		const handler = middy(() => {
			throw new Error("error");
		})
			.use(responseLogger({ logger: () => ({ chained: true }) }))
			.onError((request) => {
				request.response = "recovered";
			});

		strictEqual(await handler({ foo: "bar" }, defaultContext), "recovered");
	});

	// event-normalizer turns DynamoDB N values beyond 2^53 into BigInt, which
	// JSON.stringify cannot serialize on its own.
	test("It should log BigInt values as strings with the default logger", async (t) => {
		const log = t.mock.method(console, "log", () => {});

		const handler = middy(() => ({ id: 2n ** 64n })).use(responseLogger());

		await handler({}, defaultContext);

		strictEqual(log.mock.callCount(), 1);
		deepStrictEqual(JSON.parse(log.mock.calls[0].arguments[0]), {
			response: { id: "18446744073709551616" },
		});
	});

	// A logger failure must not change the outcome of a successful invocation.
	test("It should report a throwing logger via console.error and keep the response", async (t) => {
		const loggerError = new Error("logger down");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => "handler").use(
			responseLogger({
				logger: () => {
					throw loggerError;
				},
			}),
		);

		strictEqual(await handler({ foo: "bar" }, defaultContext), "handler");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should report a rejected async logger via console.error and keep the response", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => "handler").use(
			responseLogger({
				logger: async () => {
					throw loggerError;
				},
			}),
		);

		strictEqual(await handler({ foo: "bar" }, defaultContext), "handler");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should wait for an async logger before the invocation settles", async (t) => {
		let shipped = false;

		const handler = middy(() => "handler").use(
			responseLogger({
				logger: async () => {
					await setImmediate();
					shipped = true;
					return { chained: true };
				},
			}),
		);

		strictEqual(await handler({ foo: "bar" }, defaultContext), "handler");
		strictEqual(shipped, true);
	});

	test("It should wait for an async logger when an error is handled", async (t) => {
		let shipped = false;

		const handler = middy(() => {
			throw new Error("error");
		})
			.use(
				responseLogger({
					logger: async () => {
						await setImmediate();
						shipped = true;
						return { chained: true };
					},
				}),
			)
			.onError((request) => {
				request.response = "recovered";
			});

		strictEqual(await handler({ foo: "bar" }, defaultContext), "recovered");
		strictEqual(shipped, true);
	});

	test("It should await a thenable returned by the logger", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => "handler").use(
			responseLogger({
				logger: () => ({
					[thenKey]: (_resolve, reject) => reject(loggerError),
				}),
			}),
		);

		strictEqual(await handler({ foo: "bar" }, defaultContext), "handler");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should keep the hooks synchronous for a synchronous logger", (t) => {
		const consoleError = t.mock.method(console, "error", () => {});
		const request = { event: {}, response: "handler" };

		for (const result of [undefined, null, { chained: true }, "logged"]) {
			const logger = t.mock.fn(() => result);
			const middleware = responseLogger({ logger });
			strictEqual(middleware.after(request), undefined);
			strictEqual(middleware.onError(request), undefined);
			strictEqual(logger.mock.callCount(), 2);
		}
		strictEqual(consoleError.mock.callCount(), 0);
	});

	test("It should log the response when an error is handled", async (t) => {
		const logger = t.mock.fn();

		const handler = middy(() => {
			throw new Error("error");
		})
			.use(responseLogger({ logger }))
			.onError((request) => {
				request.response = request.event;
			});

		const event = { foo: "bar", fuu: "baz" };
		const response = await handler(event, defaultContext);

		strictEqual(logger.mock.callCount(), 1);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, event);
		deepStrictEqual(response, event);
	});

	test("It should skip logging when an error is not handled", async (t) => {
		const logger = t.mock.fn();

		const handler = middy(() => {
			throw new Error("error");
		}).use(responseLogger({ logger }));

		try {
			await handler({ foo: "bar" }, defaultContext);
		} catch (e) {
			strictEqual(e.message, "error");
		}

		strictEqual(logger.mock.callCount(), 0);
	});

	// A null response must not trip the `response?.body` stream check.
	test("It should log a null response without throwing", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(() => null).use(responseLogger({ logger }));
		const response = await handler({ foo: "bar" }, defaultContext);
		strictEqual(response, null);
		strictEqual(logger.mock.calls[0].arguments[0].response, null);
	});

	test("It should log a plain non-stream response set in onError", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(() => {
			throw new Error("boom");
		})
			.use(responseLogger({ logger }))
			.onError((request) => {
				request.response = { recovered: true };
			});
		const response = await handler({ foo: "bar" }, defaultContext);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			recovered: true,
		});
		deepStrictEqual(response, { recovered: true });
	});

	test("It should omit paths", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(
			responseLogger({ logger, omitPaths: ["response.bar"] }),
		);

		const event = { foo: "foo", bar: "bar" };
		await handler(event, defaultContext);

		deepStrictEqual(logger.mock.calls[0].arguments[0].response, { foo: "foo" });
		strictEqual(event.bar, "bar");
	});

	test("It should mask paths", async (t) => {
		const logger = t.mock.fn();

		const handler = middy(() => ({
			headers: { "set-cookie": "session=secret" },
			statusCode: 200,
		})).use(
			responseLogger({
				logger,
				omitPaths: ["response.headers.set-cookie"],
				mask: "*****",
			}),
		);

		await handler({}, defaultContext);

		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			headers: { "set-cookie": "*****" },
			statusCode: 200,
		});
	});

	// `internal` holds resolved secrets and is now reachable by the logger.
	test("It should omit paths outside the response", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event)
			.use({
				before: (request) => {
					request.internal.DB_PASSWORD = "hunter2";
				},
			})
			.use(responseLogger({ logger, omitPaths: ["internal.DB_PASSWORD"] }));

		await handler({ foo: "bar" }, defaultContext);

		strictEqual(
			Object.hasOwn(logger.mock.calls[0].arguments[0].internal, "DB_PASSWORD"),
			false,
		);
	});

	test("It should not mutate the caller-provided omitPaths array", async (t) => {
		const logger = t.mock.fn();
		const omitPaths = ["response.foo", "response.bar"];
		const original = [...omitPaths];

		const handler = middy((event) => event).use(
			responseLogger({ logger, omitPaths }),
		);
		await handler({ foo: "foo", bar: "bar" }, defaultContext);

		deepStrictEqual(omitPaths, original);
	});

	test("It should log with executionMode:executionModeStreamifyResponse using ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const logger = t.mock.fn();
		const handler = middy(
			async (event, context, { signal }) => {
				return createReadableStream(input);
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(chunkResponse, input);
		strictEqual(logger.mock.calls[0].arguments[0].response, input);
	});

	test("It should log with executionMode:executionModeStreamifyResponse using body ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const logger = t.mock.fn();
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
		).use(responseLogger({ logger }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(chunkResponse, input);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			statusCode: 200,
			headers: {
				"Content-Type": "plain/text",
			},
			body: input,
		});
	});

	test("It should cap the buffered body of a Node.js stream at maxBodyBytes", async (t) => {
		const input = "abcdefghij";
		const logger = t.mock.fn();
		const handler = middy(
			async (event, context, { signal }) => Readable.from(["abcdef", "ghij"]),
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger, maxBodyBytes: 4 }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		await handler({}, responseStream, defaultContext);
		// The client still gets the whole body.
		strictEqual(chunkResponse, input);
		strictEqual(
			logger.mock.calls[0].arguments[0].response,
			"abcd...[truncated, logged 4 of 10 bytes]",
		);
	});

	const webStreamOf = (...chunks) =>
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
				controller.close();
			},
		});

	const runWebStream = async (stream, options, collectSent = true) => {
		const logged = [];
		const handler = middy(async () => stream, {
			executionMode: executionModeStreamifyResponse,
		}).use(
			responseLogger({ ...options, logger: (request) => logged.push(request) }),
		);
		const chunks = [];
		const responseStream = createWritableStream((chunk) => {
			if (collectSent) chunks.push(chunk);
		});
		await handler({}, responseStream, defaultContext);
		const decoder = new TextDecoder();
		const sent = chunks
			.map((c) => (c instanceof Uint8Array ? decoder.decode(c) : String(c)))
			.join("");
		return { sent, logged: logged[0].response };
	};

	test("It should cap the buffered body of a Web stream of strings at maxBodyBytes", async () => {
		const { sent, logged } = await runWebStream(webStreamOf("abcdef", "ghij"), {
			maxBodyBytes: 4,
		});
		strictEqual(sent, "abcdefghij");
		strictEqual(logged, "abcd...[truncated, logged 4 of 10 bytes]");
	});

	test("It should cap the buffered body of a Web stream of bytes at maxBodyBytes", async () => {
		const encoder = new TextEncoder();
		const { sent, logged } = await runWebStream(
			webStreamOf(encoder.encode("abcdef"), encoder.encode("ghij")),
			{ maxBodyBytes: 7 },
		);
		strictEqual(sent, "abcdefghij");
		strictEqual(logged, "abcdefg...[truncated, logged 7 of 10 bytes]");
	});

	test("It should drop a multi-byte character cut by maxBodyBytes rather than mangle it", async () => {
		// "é" is 2 bytes in UTF-8; the cap falls between them.
		const { sent, logged } = await runWebStream(webStreamOf("abé", "cd"), {
			maxBodyBytes: 3,
		});
		strictEqual(sent, "abécd");
		strictEqual(logged, "ab...[truncated, logged 3 of 6 bytes]");
	});

	test("It should log a body of exactly the CloudWatch Logs event size (1 MiB) whole by default", async () => {
		const input = "x".repeat(1024 * 1024);
		const { logged } = await runWebStream(webStreamOf(input), {}, false);
		strictEqual(logged, input);
	});

	test("It should cap the logged body at the CloudWatch Logs event size (1 MiB) by default", async () => {
		const mib = new Uint8Array(1024 * 1024).fill(120); // "x"
		const { logged } = await runWebStream(
			webStreamOf(mib, new Uint8Array([121])),
			{},
			false,
		);
		const marker = "...[truncated, logged 1048576 of 1048577 bytes]";
		strictEqual(logged.length, 1048576 + marker.length);
		ok(logged.endsWith(`x${marker}`));
	});

	test("It should log a body over 1 MiB whole when maxBodyBytes allows it", async () => {
		const input = "x".repeat(1024 * 1024 + 1);
		const { logged } = await runWebStream(
			webStreamOf(input),
			{ maxBodyBytes: 2 * 1024 * 1024 },
			false,
		);
		strictEqual(logged, input);
	});

	test("It should decode only the bytes it keeps, and none past maxBodyBytes", async (t) => {
		const encoder = new TextEncoder();
		const first = encoder.encode("abcd");
		const decode = t.mock.method(TextDecoder.prototype, "decode");
		const { logged } = await runWebStream(
			webStreamOf(first, encoder.encode("efgh")),
			{ maxBodyBytes: 4 },
			false,
		);
		strictEqual(logged, "abcd...[truncated, logged 4 of 8 bytes]");
		// A chunk that fits is decoded as-is, not through a copy, and a chunk
		// arriving once the cap is reached is not decoded at all.
		strictEqual(decode.mock.callCount(), 1);
		strictEqual(decode.mock.calls[0].arguments[0], first);
	});

	test("It should log the whole body when it is exactly maxBodyBytes", async () => {
		const { logged } = await runWebStream(webStreamOf("abcd"), {
			maxBodyBytes: 4,
		});
		strictEqual(logged, "abcd");
	});

	test("It should log with Web Streams API using ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const logger = t.mock.fn();
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(input);
						controller.close();
					},
				});
				return stream;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(chunkResponse, input);
		strictEqual(logger.mock.calls[0].arguments[0].response, input);
	});

	test("It should log with Web Streams API using body ReadableStream", async (t) => {
		const input = "x".repeat(1024 * 1024);
		const logger = t.mock.fn();
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(input);
						controller.close();
					},
				});
				return {
					statusCode: 200,
					headers: {
						"Content-Type": "plain/text",
					},
					body: stream,
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(chunkResponse, input);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			statusCode: 200,
			headers: {
				"Content-Type": "plain/text",
			},
			body: input,
		});
	});

	test("It should handle Uint8Array chunks in Web Streams", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		const input = "test data";
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new ReadableStream({
					start(controller) {
						const encoder = new TextEncoder();
						controller.enqueue(encoder.encode(input));
						controller.close();
					},
				});
				return stream;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		const chunks = [];
		const responseStream = createWritableStream((chunk) => {
			chunks.push(chunk);
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		const chunkResponse = chunks
			.map((c) =>
				c instanceof Uint8Array ? new TextDecoder().decode(c) : String(c),
			)
			.join("");
		strictEqual(chunkResponse, input);
		strictEqual(logged.length, 1);
		strictEqual(logged[0].response, input);
	});

	test("It should handle non-string non-Uint8Array chunks in Web Streams", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(12345);
						controller.close();
					},
				});
				return stream;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(chunkResponse, "12345");
		strictEqual(logged.length, 1);
		strictEqual(logged[0].response, "12345");
	});

	test("It should propagate Node.js stream errors instead of hanging", async (t) => {
		const logger = t.mock.fn();
		const streamError = new Error("stream broke");
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new Readable({
					read() {
						this.push("partial");
						this.destroy(streamError);
					},
				});
				return stream;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		const responseStream = createWritableStream(() => {});
		await t.assert.rejects(
			handler({}, responseStream, defaultContext),
			(err) => {
				strictEqual(err.message, "stream broke");
				return true;
			},
		);
	});

	test("It should propagate Node.js stream errors when response has body stream", async (t) => {
		const logger = t.mock.fn();
		const streamError = new Error("body stream broke");
		const handler = middy(
			async (event, context, { signal }) => {
				const stream = new Readable({
					read() {
						this.push("partial");
						this.destroy(streamError);
					},
				});
				return {
					statusCode: 200,
					headers: { "Content-Type": "plain/text" },
					body: stream,
				};
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		const responseStream = createWritableStream(() => {});
		await t.assert.rejects(
			handler({}, responseStream, defaultContext),
			(err) => {
				strictEqual(err.message, "body stream broke");
				return true;
			},
		);
	});

	test("It should log a multi-byte character split across Web Stream chunks", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		// "héllo😀" where é is 2 bytes and 😀 is 4 bytes; the encoded byte array is
		// split mid-character across chunk boundaries.
		const text = "héllo😀";
		const bytes = new TextEncoder().encode(text);
		const chunkA = bytes.slice(0, 2); // ends mid "é"
		const chunkB = bytes.slice(2, 9); // ends mid "😀"
		const chunkC = bytes.slice(9);
		const handler = middy(
			async () => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(chunkA);
						controller.enqueue(chunkB);
						controller.enqueue(chunkC);
						controller.close();
					},
				});
				return stream;
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		const responseStream = createWritableStream(() => {});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(logged.length, 1);
		strictEqual(logged[0].response, text);
	});

	test("It should log a multi-byte character split across Node Stream chunks", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		const text = "héllo😀";
		const bytes = new TextEncoder().encode(text);
		const chunkA = Buffer.from(bytes.slice(0, 2)); // ends mid "é"
		const chunkB = Buffer.from(bytes.slice(2, 9)); // ends mid "😀"
		const chunkC = Buffer.from(bytes.slice(9));
		const handler = middy(
			async () => {
				return Readable.from([chunkA, chunkB, chunkC]);
			},
			{
				executionMode: executionModeStreamifyResponse,
			},
		).use(responseLogger({ logger }));

		const responseStream = createWritableStream(() => {});
		const response = await handler({}, responseStream, defaultContext);
		strictEqual(response, undefined);
		strictEqual(logged.length, 1);
		strictEqual(logged[0].response, text);
	});

	test("It should not corrupt a second Web Stream with state from the first", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		// First stream ends with an incomplete multi-byte sequence (a lone lead
		// byte of "é"). A shared streaming decoder would retain that partial byte
		// and prepend its replacement/continuation to the next stream.
		const firstBytes = new TextEncoder().encode("ab").slice(0, 2);
		const danglingLead = Uint8Array.from([0xc3]); // lead byte of "é", no trailer
		const makeHandler = (chunks) =>
			middy(
				async () => {
					const stream = new ReadableStream({
						start(controller) {
							for (const chunk of chunks) controller.enqueue(chunk);
							controller.close();
						},
					});
					return stream;
				},
				{
					executionMode: executionModeStreamifyResponse,
				},
			).use(responseLogger({ logger }));

		const responseStreamA = createWritableStream(() => {});
		await makeHandler([firstBytes, danglingLead])(
			{},
			responseStreamA,
			defaultContext,
		);

		const second = "second";
		const responseStreamB = createWritableStream(() => {});
		await makeHandler([new TextEncoder().encode(second)])(
			{},
			responseStreamB,
			defaultContext,
		);

		strictEqual(logged.length, 2);
		strictEqual(logged[1].response, second);
	});

	// With a wrapper the teed stream is reattached to `.body`, so the wrapper
	// survives into the log; a bare stream is reattached to `response` itself.
	test("It should log decoded body for a bare body-stream response (object wrapper preserved)", async (t) => {
		const input = "wrapped-body";
		const logger = t.mock.fn();
		const handler = middy(
			async () => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue(input);
						controller.close();
					},
				});
				return { statusCode: 201, body: stream };
			},
			{ executionMode: executionModeStreamifyResponse },
		).use(responseLogger({ logger }));
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		await handler({}, responseStream, defaultContext);
		strictEqual(chunkResponse, input);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			statusCode: 201,
			body: input,
		});
	});

	// A string chunk must pass through, not be coerced via String()/decoder.
	test("It should pass string chunks through a Web Stream unchanged", async (t) => {
		const logged = [];
		const logger = (request) => {
			logged.push(request);
		};
		const input = "plain-string-chunk";
		const handler = middy(
			async () => {
				return new ReadableStream({
					start(controller) {
						controller.enqueue(input);
						controller.close();
					},
				});
			},
			{ executionMode: executionModeStreamifyResponse },
		).use(responseLogger({ logger }));
		const responseStream = createWritableStream(() => {});
		await handler({}, responseStream, defaultContext);
		strictEqual(logged[0].response, input);
	});

	test("It should omit paths on a streamed response", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(
			async () => {
				const stream = new ReadableStream({
					start(controller) {
						controller.enqueue("secret-body");
						controller.close();
					},
				});
				return { statusCode: 201, body: stream };
			},
			{ executionMode: executionModeStreamifyResponse },
		).use(
			responseLogger({
				logger,
				omitPaths: ["response.body"],
				mask: "[redacted]",
			}),
		);
		const responseStream = createWritableStream(() => {});
		await handler({}, responseStream, defaultContext);
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			statusCode: 201,
			body: "[redacted]",
		});
	});

	test("responseLoggerValidateOptions accepts valid options and rejects typos", () => {
		responseLoggerValidateOptions({
			logger: () => {},
			omitPaths: ["response.a.b"],
			mask: "***",
			maxBodyBytes: 1024,
		});
		responseLoggerValidateOptions({});
		try {
			responseLoggerValidateOptions({ omitPath: ["a"] });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/response-logger");
		}
	});

	test("It should omit an array path whose segment holds a dot", async (t) => {
		const logger = t.mock.fn();
		const omitPaths = [["response", "user.email"]];
		responseLoggerValidateOptions({ omitPaths });

		const handler = middy(() => ({ "user.email": "a@example.com", id: 7 })).use(
			responseLogger({ logger, omitPaths }),
		);

		const response = await handler({}, defaultContext);

		deepStrictEqual(logger.mock.calls[0].arguments[0].response, { id: 7 });
		deepStrictEqual(response, { "user.email": "a@example.com", id: 7 });
	});

	test("responseLoggerValidateOptions rejects an omitPaths entry that is not a string or an array of strings", () => {
		for (const entry of [1, null, {}, ["response", 1], [["response"]], []]) {
			throws(() => responseLoggerValidateOptions({ omitPaths: [entry] }), {
				name: "TypeError",
				message: "Option 'omitPaths[0]' must match exactly one schema in oneOf",
				cause: { package: "@middy/response-logger" },
			});
		}
	});

	test("responseLoggerValidateOptions rejects a path that could never match", () => {
		for (const path of [
			"response.items[].body",
			"response.items.0.body",
			"response.items.*.body",
			["response", "items", "__proto__"],
		]) {
			const invalidPath = { name: "TypeError", message: /^Invalid path / };
			throws(
				() => responseLoggerValidateOptions({ omitPaths: [path] }),
				invalidPath,
			);
			throws(() => responseLogger({ omitPaths: [path] }), invalidPath);
		}
		responseLoggerValidateOptions({
			omitPaths: ["response.items.[].body", ["response", "items", "[]", "0"]],
		});
	});

	test("responseLoggerValidateOptions rejects wrong types", () => {
		try {
			responseLoggerValidateOptions({ logger: "not-a-fn" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("logger"));
		}
		try {
			responseLoggerValidateOptions({ omitPaths: "response.a" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("omitPaths"));
		}
		try {
			responseLoggerValidateOptions({ mask: 1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("mask"));
		}
		for (const maxBodyBytes of [0, 1.5, "1024"]) {
			throws(
				() => responseLoggerValidateOptions({ maxBodyBytes }),
				(e) => e.message.includes("maxBodyBytes"),
			);
		}
	});

	test("responseLoggerValidateOptions caps mask at 1024 printable characters", () => {
		responseLoggerValidateOptions({ mask: "***omitted***" });
		responseLoggerValidateOptions({ mask: "x".repeat(1024) });
		throws(() => responseLoggerValidateOptions({ mask: "x".repeat(1025) }), {
			name: "TypeError",
			message: "Option 'mask' must have length <= 1024",
			cause: { package: "@middy/response-logger" },
		});
		throws(() => responseLoggerValidateOptions({ mask: "line\nbreak" }), {
			name: "TypeError",
			message: /^Option 'mask' must match pattern /,
			cause: { package: "@middy/response-logger" },
		});
	});

	test("responseLoggerValidateOptions caps maxBodyBytes at the longest string V8 can hold", () => {
		responseLoggerValidateOptions({
			maxBodyBytes: bufferConstants.MAX_STRING_LENGTH,
		});
		throws(
			() =>
				responseLoggerValidateOptions({
					maxBodyBytes: bufferConstants.MAX_STRING_LENGTH + 1,
				}),
			{
				name: "TypeError",
				message: `Option 'maxBodyBytes' must be <= ${bufferConstants.MAX_STRING_LENGTH}`,
				cause: { package: "@middy/response-logger" },
			},
		);
	});

	test("It should destroy the source stream when the consumer destroys the teed response early", async (t) => {
		const logger = t.mock.fn();
		const source = new Readable({ read() {} });
		const request = { event: {}, context: {}, internal: {}, response: source };
		responseLogger({ logger }).after(request);
		const teed = request.response;
		ok(teed !== source);
		teed.on("error", () => {});
		const closed = new Promise((resolve) => teed.once("close", resolve));
		teed.destroy(new Error("consumer gone"));
		await closed;
		strictEqual(source.destroyed, true);
		strictEqual(logger.mock.callCount(), 0);
	});

	test("It should still end a Node stream when the logger throws on flush", async (t) => {
		const error = new Error("logger broke");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(async () => Readable.from(["a", "b"]), {
			executionMode: executionModeStreamifyResponse,
		}).use(
			responseLogger({
				logger: () => {
					throw error;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], error);
	});

	test("It should still end a Web stream when the logger throws on flush", async (t) => {
		const error = new Error("logger broke");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(
			async () =>
				new ReadableStream({
					start(controller) {
						controller.enqueue("a");
						controller.enqueue("b");
						controller.close();
					},
				}),
			{ executionMode: executionModeStreamifyResponse },
		).use(
			responseLogger({
				logger: () => {
					throw error;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], error);
	});

	test("It should still end a Node stream when an async logger rejects on flush", async (t) => {
		const error = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(async () => Readable.from(["a", "b"]), {
			executionMode: executionModeStreamifyResponse,
		}).use(
			responseLogger({
				logger: async () => {
					await setImmediate();
					throw error;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], error);
	});

	test("It should end a Node stream only once an async logger has settled", async (t) => {
		let shipped = false;
		const handler = middy(async () => Readable.from(["a", "b"]), {
			executionMode: executionModeStreamifyResponse,
		}).use(
			responseLogger({
				logger: async () => {
					await setImmediate();
					shipped = true;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(shipped, true);
	});

	test("It should end a Web stream only once an async logger has settled", async (t) => {
		let shipped = false;
		const handler = middy(
			async () =>
				new ReadableStream({
					start(controller) {
						controller.enqueue("a");
						controller.enqueue("b");
						controller.close();
					},
				}),
			{ executionMode: executionModeStreamifyResponse },
		).use(
			responseLogger({
				logger: async () => {
					await setImmediate();
					shipped = true;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(shipped, true);
	});

	test("It should still end a Web stream when an async logger rejects on flush", async (t) => {
		const error = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(
			async () =>
				new ReadableStream({
					start(controller) {
						controller.enqueue("a");
						controller.enqueue("b");
						controller.close();
					},
				}),
			{ executionMode: executionModeStreamifyResponse },
		).use(
			responseLogger({
				logger: async () => {
					await setImmediate();
					throw error;
				},
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		strictEqual(await handler({}, responseStream, defaultContext), undefined);
		strictEqual(chunkResponse, "ab");
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], error);
	});

	test("It should leave a body stream untouched when omitPaths drops response.body", async (t) => {
		for (const makeStream of [
			() => Readable.from(["secret-body"]),
			() => webStreamOf("secret-body"),
		]) {
			const logger = t.mock.fn();
			const stream = makeStream();
			for (const omitPaths of [
				["response.body"],
				["Response.Body"],
				[["response", "body"]],
			]) {
				logger.mock.resetCalls();
				const handler = middy(async () => ({
					statusCode: 201,
					body: stream,
				})).use(responseLogger({ logger, omitPaths }));

				const response = await handler({}, defaultContext);

				strictEqual(response.body, stream);
				strictEqual(logger.mock.callCount(), 1);
				deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
					statusCode: 201,
				});
			}
		}
	});

	test("It should leave a streamed response untouched when omitPaths drops the whole response", async (t) => {
		for (const makeStream of [
			() => Readable.from(["secret-body"]),
			() => webStreamOf("secret-body"),
		]) {
			const logger = t.mock.fn();
			const stream = makeStream();
			const bare = middy(async () => stream).use(
				responseLogger({ logger, omitPaths: ["response"] }),
			);
			strictEqual(await bare({ foo: "bar" }, defaultContext), stream);

			const wrapped = middy(async () => ({
				statusCode: 201,
				body: stream,
			})).use(responseLogger({ logger, omitPaths: ["response"], mask: "***" }));
			strictEqual((await wrapped({}, defaultContext)).body, stream);

			strictEqual(logger.mock.callCount(), 2);
			const [bareRequest] = logger.mock.calls[0].arguments;
			strictEqual(Object.hasOwn(bareRequest, "response"), false);
			deepStrictEqual(bareRequest.event, { foo: "bar" });
			strictEqual(logger.mock.calls[1].arguments[0].response, "***");
		}
	});

	test("It should leave a bare stream untouched when omitPaths names a path under response", async (t) => {
		for (const makeStream of [
			() => Readable.from(["secret-body"]),
			() => webStreamOf("secret-body"),
		]) {
			for (const omitPaths of [
				["response.body"],
				["response.headers.set-cookie"],
			]) {
				const logger = t.mock.fn();
				const stream = makeStream();

				const handler = middy(async () => stream).use(
					responseLogger({ logger, omitPaths }),
				);
				strictEqual(await handler({ foo: "bar" }, defaultContext), stream);

				const masked = middy(async () => stream).use(
					responseLogger({ logger, omitPaths, mask: "***" }),
				);
				strictEqual(await masked({ foo: "bar" }, defaultContext), stream);

				strictEqual(logger.mock.callCount(), 2);
				const [request] = logger.mock.calls[0].arguments;
				strictEqual(Object.hasOwn(request, "response"), false);
				deepStrictEqual(request.event, { foo: "bar" });
				strictEqual(logger.mock.calls[1].arguments[0].response, "***");
			}
		}
	});

	test("It should leave a body stream untouched when omitPaths reaches past response.body", async (t) => {
		for (const makeStream of [
			() => Readable.from(["secret-body"]),
			() => webStreamOf("secret-body"),
		]) {
			const logger = t.mock.fn();
			const stream = makeStream();
			const lambdaHandler = async () => ({
				statusCode: 201,
				headers: { "set-cookie": "session=1", etag: "abc" },
				body: stream,
			});
			const omitPaths = ["response.body.token", "response.headers.set-cookie"];

			const handler = middy(lambdaHandler).use(
				responseLogger({ logger, omitPaths }),
			);
			strictEqual((await handler({}, defaultContext)).body, stream);

			const masked = middy(lambdaHandler).use(
				responseLogger({ logger, omitPaths, mask: "***" }),
			);
			strictEqual((await masked({}, defaultContext)).body, stream);

			strictEqual(logger.mock.callCount(), 2);
			deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
				statusCode: 201,
				headers: { etag: "abc" },
			});
			deepStrictEqual(logger.mock.calls[1].arguments[0].response, {
				statusCode: 201,
				headers: { "set-cookie": "***", etag: "abc" },
				body: "***",
			});
		}
	});

	test("It should still capture a body stream when omitPaths only names its siblings", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(
			async () => ({
				statusCode: 201,
				headers: { "set-cookie": "session=1", etag: "abc" },
				body: webStreamOf("stream-body"),
			}),
			{ executionMode: executionModeStreamifyResponse },
		).use(
			responseLogger({
				logger,
				omitPaths: ["response.headers.set-cookie", "response.bodyless"],
			}),
		);
		let chunkResponse = "";
		const responseStream = createWritableStream((chunk) => {
			chunkResponse += chunk;
		});
		await handler({}, responseStream, defaultContext);
		strictEqual(chunkResponse, "stream-body");
		deepStrictEqual(logger.mock.calls[0].arguments[0].response, {
			statusCode: 201,
			headers: { etag: "abc" },
			body: "stream-body",
		});
	});

	test("It should still capture a bare stream when omitPaths names nothing under response", async (t) => {
		const { sent, logged } = await runWebStream(webStreamOf("abc", "def"), {
			omitPaths: ["event.headers.authorization", "internal.response"],
		});
		strictEqual(sent, "abcdef");
		strictEqual(logged, "abcdef");
	});
});
