import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
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

test("It should return no-op middleware when logger is false", async (t) => {
	const middleware = responseLogger({ logger: false });
	strictEqual(middleware.before, undefined);
	strictEqual(middleware.after, undefined);
	strictEqual(middleware.onError, undefined);
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
	await t.assert.rejects(handler({}, responseStream, defaultContext), (err) => {
		strictEqual(err.message, "stream broke");
		return true;
	});
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
	await t.assert.rejects(handler({}, responseStream, defaultContext), (err) => {
		strictEqual(err.message, "body stream broke");
		return true;
	});
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
});

test("responseLoggerValidateOptions accepts logger:false and rejects logger:true", () => {
	responseLoggerValidateOptions({ logger: false });
	try {
		responseLoggerValidateOptions({ logger: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("logger"));
	}
});
