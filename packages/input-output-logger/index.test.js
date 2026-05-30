import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { createReadableStream, createWritableStream } from "@datastream/core";
// import {
// 	executionModeDurableContext,
// } from "../core/executionModeDurableContext.js";
import { executionModeStreamifyResponse } from "../core/executionModeStreamifyResponse.js";
import middy from "../core/index.js";
import inputOutputLogger, {
	inputOutputLoggerValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

class DurableContextImpl {
	constructor(props = {}) {
		Object.assign(this, props);
	}
	async step(_id, fn) {
		return fn(this);
	}
	async runInChildContext(_id, fn) {
		return fn(this);
	}
}

test("It should log event and response", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = { foo: "bar", fuu: "baz" };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: event }]);
	deepStrictEqual(response, event);
});

// streamifyResponse
globalThis.awslambda = {
	streamifyResponse: (cb) => cb,
	HttpResponseStream: {
		from: (responseStream, metadata) => {
			return responseStream;
		},
	},
};

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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(chunkResponse, input);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: {} }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: input,
		},
	]);
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(chunkResponse, input);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: {} }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: {
				statusCode: 200,
				headers: {
					"Content-Type": "plain/text",
				},
				body: input,
			},
		},
	]);
});

test("It should log with Web Streams API using ReadableStream", async (t) => {
	const input = "x".repeat(1024 * 1024);
	const logger = t.mock.fn();
	const handler = middy(
		async (event, context, { signal }) => {
			// Create a Web ReadableStream
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(chunkResponse, input);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: {} }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: input,
		},
	]);
});

test("It should log with Web Streams API using body ReadableStream", async (t) => {
	const input = "x".repeat(1024 * 1024);
	const logger = t.mock.fn();
	const handler = middy(
		async (event, context, { signal }) => {
			// Create a Web ReadableStream in the body
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(chunkResponse, input);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: {} }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: {
				statusCode: 200,
				headers: {
					"Content-Type": "plain/text",
				},
				body: input,
			},
		},
	]);
});

test("It should return no-op middleware when logger is false", async (t) => {
	const middleware = inputOutputLogger({ logger: false });
	strictEqual(middleware.before, undefined);
	strictEqual(middleware.after, undefined);
	strictEqual(middleware.onError, undefined);
});

test("It should reject invalid logger via option validator", async (t) => {
	try {
		inputOutputLoggerValidateOptions({ logger: "not-a-fn" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("logger"));
	}
});

test("It should skip prototype-pollution paths in omitPaths", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: [
				"event.__proto__.bad",
				"event.constructor.bad",
				"event.prototype.bad",
				"event.ok",
			],
		}),
	);
	const event = { ok: "ok", bad: "keep" };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { bad: "keep" } }]);
});

test("It should omit paths", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.foo", "response.bar"],
		}),
	);

	const event = { foo: "foo", bar: "bar" };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { bar: "bar" } }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { foo: "foo" } },
	]);

	deepStrictEqual(response, event);
});

test("It should mask paths", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.foo", "response.bar"],
			mask: "*****",
		}),
	);

	const event = { foo: "foo", bar: "bar" };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { foo: "*****", bar: "bar" } },
	]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { foo: "foo", bar: "*****" } },
	]);

	deepStrictEqual(response, event);
});

test("It should not inject a phantom key when masking an absent omitPath", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.absent"],
			mask: "*****",
		}),
	);

	const event = { foo: "foo" };
	await handler(event, defaultContext);

	// `absent` is not on the payload, so masking must not add it as a new key.
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { foo: "foo" } }]);
	ok(!Object.hasOwn(logger.mock.calls[0].arguments[0].event, "absent"));
});

test("It should omit nested paths", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.foo.foo", "response.bar.[].bar"],
		}),
	);

	const event = { foo: { foo: "foo" }, bar: [{ bar: "bar" }] };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { ...event, foo: {} } },
	]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { ...event, bar: [{}] } },
	]);

	deepStrictEqual(response, event);
});

test("It should omit nested paths with conflicting paths", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.foo.foo", "event.bar.[].bar", "event.bar"],
		}),
	);

	const event = { foo: { foo: "foo" }, bar: [{ bar: "bar" }] };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { foo: {} } }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: event }]);

	deepStrictEqual(response, event);
});

test("It should skip paths that do not exist", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: [
				"event.string.string",
				"event.object.object",
				"event.array.array",
				"event.null.null",
				"event.true.true",
				"event.false.false",
				"event.zero.zero",
				"event.one.one",
				"event.NaN.NaN",
				"event.__proto__.__proto__",
				"event.undefined.undefined",
			],
		}),
	);

	const event = {
		string: "string",
		object: { key: "value" },
		array: ["value"],
		null: null,
		true: true,
		false: false,
		zero: 0,
		one: 1,
	};
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: event }]);

	deepStrictEqual(response, event);
});

test("It should include the AWS lambda context", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
			lambdaContext: true,
		}),
	);

	const event = { foo: "bar", fuu: "baz" };
	const context = {
		...defaultContext,
		functionName: "test",
		awsRequestId: "xxxxx",
	};
	const response = await handler(event, context);

	deepStrictEqual(response, event);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event,
			context: { functionName: "test", awsRequestId: "xxxxx" },
		},
	]);

	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: event,
			context: { functionName: "test", awsRequestId: "xxxxx" },
		},
	]);
});

test("It should include only the execution context when lambdaContext is off (standard mode)", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
		}),
	);

	const event = { foo: "bar" };
	const context = {
		...defaultContext,
		tenantId: "alpha",
		functionName: "test",
	};
	await handler(event, context);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event, context: { tenantId: "alpha" } },
	]);
});

test("It should include the AWS lambda durable context", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
			lambdaContext: true,
		}),
	);

	const event = { foo: "bar", fuu: "baz" };
	const context = new DurableContextImpl({
		executionContext: {
			requestId: "uuid",
			tenantId: "alpha",
		},
		lambdaContext: {
			...defaultContext,
			functionName: "test",
			awsRequestId: "xxxxx",
		},
	});
	const response = await handler(event, context);

	deepStrictEqual(response, event);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event,
			context: {
				executionContext: {
					tenantId: "alpha",
				},
				lambdaContext: {
					functionName: "test",
					awsRequestId: "xxxxx",
				},
			},
		},
	]);

	deepStrictEqual(logger.mock.calls[1].arguments, [
		{
			response: event,
			context: {
				executionContext: {
					tenantId: "alpha",
				},
				lambdaContext: {
					functionName: "test",
					awsRequestId: "xxxxx",
				},
			},
		},
	]);
});

test("It should include only the execution context (durable mode, no lambdaContext requested)", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
		}),
	);
	await handler(
		{ foo: "bar" },
		new DurableContextImpl({
			executionContext: { tenantId: "alpha" },
			lambdaContext: { functionName: "test" },
		}),
	);
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event: { foo: "bar" },
			context: { executionContext: { tenantId: "alpha" } },
		},
	]);
});

test("It should include only the lambda context (durable mode, no executionContext requested)", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			lambdaContext: true,
		}),
	);

	const event = { foo: "bar" };
	// No `executionContext` field — verifies pick handles absent source.
	const context = new DurableContextImpl({
		lambdaContext: { functionName: "test", awsRequestId: "xxxxx" },
	});
	await handler(event, context);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event,
			context: {
				lambdaContext: { functionName: "test", awsRequestId: "xxxxx" },
			},
		},
	]);
});

test("It should handle durable context with the requested namespace absent", async (t) => {
	// `executionContext: true` but context.executionContext doesn't exist.
	// pick is called with an undefined source and returns null cleanly.
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
			lambdaContext: true,
		}),
	);
	await handler(
		{ foo: "bar" },
		// No `executionContext` — only lambdaContext present.
		new DurableContextImpl({
			lambdaContext: { functionName: "test", awsRequestId: "xxxxx" },
		}),
	);
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event: { foo: "bar" },
			context: {
				lambdaContext: { functionName: "test", awsRequestId: "xxxxx" },
			},
		},
	]);
});

test("It should produce no message.context when picks find nothing (durable mode)", async (t) => {
	// Both flags on, both inner contexts present but with no recognised keys —
	// pick returns null for both, buildContext returns null, message.context
	// is omitted.
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: true,
			lambdaContext: true,
		}),
	);
	await handler(
		{ foo: "bar" },
		new DurableContextImpl({
			executionContext: { unrelated: "x" },
			lambdaContext: { unrelated: "y" },
		}),
	);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { foo: "bar" } }]);
});

test("It should skip logging if error is handled", async (t) => {
	const logger = t.mock.fn();

	const handler = middy(() => {
		throw new Error("error");
	})
		.use(
			inputOutputLogger({
				logger,
			}),
		)
		.onError((request) => {
			request.response = request.event;
		});

	const event = { foo: "bar", fuu: "baz" };
	const response = await handler(event, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: event }]);
	strictEqual(logger.mock.callCount(), 2);
	deepStrictEqual(response, event);
});

test("It should skip logging if error is not handled", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => {
		throw new Error("error");
	}).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = { foo: "bar", fuu: "baz" };
	try {
		await handler(event, defaultContext);
	} catch (e) {
		deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
		strictEqual(logger.mock.callCount(), 1);
		strictEqual(e.message, "error");
	}
});

test("It should use default logger when no logger is provided", async (t) => {
	// Mock console.log to capture default logger output
	const originalLog = console.log;
	const logCalls = [];
	console.log = (message) => {
		logCalls.push(message);
	};

	const handler = middy((event) => event).use(inputOutputLogger());

	const event = { foo: "bar" };
	const response = await handler(event, defaultContext);

	// Restore console.log
	console.log = originalLog;

	strictEqual(logCalls.length, 2);
	deepStrictEqual(JSON.parse(logCalls[0]), { event });
	deepStrictEqual(JSON.parse(logCalls[1]), { response: event });
	deepStrictEqual(response, event);
});

test("It should handle Uint8Array chunks in Web Streams", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
	};
	const input = "test data";
	const handler = middy(
		async (event, context, { signal }) => {
			// Create a Web ReadableStream that emits Uint8Array chunks
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	const chunks = [];
	const responseStream = createWritableStream((chunk) => {
		chunks.push(chunk);
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	const chunkResponse = chunks
		.map((c) =>
			c instanceof Uint8Array ? new TextDecoder().decode(c) : String(c),
		)
		.join("");
	strictEqual(chunkResponse, input);
	strictEqual(logged.length, 2);
	deepStrictEqual(logged[0], { event: {} });
	// The logged response should have decoded the Uint8Array to text
	strictEqual(logged[1].response, input);
});

test("It should handle non-string non-Uint8Array chunks in Web Streams", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
	};
	const handler = middy(
		async (event, context, { signal }) => {
			// Create a Web ReadableStream that emits a number chunk
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(chunkResponse, "12345");
	strictEqual(logged.length, 2);
	deepStrictEqual(logged[0], { event: {} });
	strictEqual(logged[1].response, "12345");
});

test("It should propagate Node.js stream errors instead of hanging", async (t) => {
	const logger = t.mock.fn();
	const streamError = new Error("stream broke");
	const handler = middy(
		async (event, context, { signal }) => {
			// Create a Node.js Readable that emits some data then errors
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	const responseStream = createWritableStream(() => {});
	await t.assert.rejects(
		handler(event, responseStream, defaultContext),
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	const responseStream = createWritableStream(() => {});
	await t.assert.rejects(
		handler(event, responseStream, defaultContext),
		(err) => {
			strictEqual(err.message, "body stream broke");
			return true;
		},
	);
});

test("It should log a multi-byte character split across Web Stream chunks", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
	};
	// "héllo😀" where é is 2 bytes and 😀 is 4 bytes; the encoded byte array is
	// split mid-character across chunk boundaries.
	const text = "héllo😀";
	const bytes = new TextEncoder().encode(text);
	// Split so that the multi-byte sequences straddle chunk boundaries.
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	const responseStream = createWritableStream(() => {});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(logged.length, 2);
	strictEqual(logged[1].response, text);
});

test("It should log a multi-byte character split across Node Stream chunks", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
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
	).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = {};
	const responseStream = createWritableStream(() => {});
	const response = await handler(event, responseStream, defaultContext);
	strictEqual(response, undefined);
	strictEqual(logged.length, 2);
	strictEqual(logged[1].response, text);
});

test("It should not corrupt a second Web Stream with state from the first", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
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
		).use(inputOutputLogger({ logger }));

	const responseStreamA = createWritableStream(() => {});
	await makeHandler([firstBytes, danglingLead])(
		{},
		responseStreamA,
		defaultContext,
	);

	// Second, well-formed stream must decode cleanly without leftover state.
	const second = "second";
	const responseStreamB = createWritableStream(() => {});
	await makeHandler([new TextEncoder().encode(second)])(
		{},
		responseStreamB,
		defaultContext,
	);

	strictEqual(logged.length, 4);
	strictEqual(logged[3].response, second);
});

test("It should not mutate the caller-provided omitPaths array", async (t) => {
	const logger = t.mock.fn();
	const omitPaths = ["event.foo", "response.bar"];
	const original = [...omitPaths];
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths,
		}),
	);
	await handler({ foo: "foo", bar: "bar" }, defaultContext);
	deepStrictEqual(omitPaths, original);
});

test("inputOutputLoggerValidateOptions accepts valid options and rejects typos", () => {
	inputOutputLoggerValidateOptions({
		logger: () => {},
		omitPaths: ["a.b"],
		mask: "[REDACTED]",
	});
	inputOutputLoggerValidateOptions({});
	try {
		inputOutputLoggerValidateOptions({ omitPths: [] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/input-output-logger");
	}
});

test("inputOutputLoggerValidateOptions rejects wrong type", () => {
	try {
		inputOutputLoggerValidateOptions({ omitPaths: "a.b" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("omitPaths"));
	}
});

// L22 default omitPaths is [] (nothing omitted). The mutant replaces the
// default with ["Stryker was here"], which would omit that exact top-level key.
test("It should not omit any key by default (empty omitPaths)", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(inputOutputLogger({ logger }));
	const event = { "Stryker was here": "keep", foo: "bar" };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: event }]);
});

// L20 default executionContext is false; L51 withContext = exec||lambda; L55
// `if (withContext)`. With no flags set and a context carrying recognised keys,
// no `context` must be attached to the message.
test("It should not attach context by default", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(inputOutputLogger({ logger }));
	const event = { foo: "bar" };
	const context = {
		...defaultContext,
		tenantId: "alpha",
		functionName: "test",
		awsRequestId: "xxxxx",
	};
	await handler(event, context);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	ok(!Object.hasOwn(logger.mock.calls[0].arguments[0], "context"));
});

// L51 withContext = executionContext || lambdaContext. When BOTH are false we
// must not build context even if requested elsewhere. Covered by default test
// above; here we explicitly set both false alongside a populated context.
test("It should not attach context when both context flags are false", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			executionContext: false,
			lambdaContext: false,
		}),
	);
	const context = {
		...defaultContext,
		tenantId: "alpha",
		functionName: "test",
	};
	await handler({ foo: "bar" }, context);
	ok(!Object.hasOwn(logger.mock.calls[0].arguments[0], "context"));
});

// L30 executionContext schema { type: "boolean" }. Mutant empties the schema or
// blanks the type, so a non-boolean is no longer rejected.
test("inputOutputLoggerValidateOptions rejects non-boolean executionContext", () => {
	try {
		inputOutputLoggerValidateOptions({ executionContext: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("executionContext"));
	}
	inputOutputLoggerValidateOptions({ executionContext: true });
});

// L31 lambdaContext schema { type: "boolean" }. Mutant empties the schema or
// blanks the type, so a non-boolean is no longer rejected.
test("inputOutputLoggerValidateOptions rejects non-boolean lambdaContext", () => {
	try {
		inputOutputLoggerValidateOptions({ lambdaContext: 1 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("lambdaContext"));
	}
	inputOutputLoggerValidateOptions({ lambdaContext: false });
});

// L29 logger schema `const: false`. Mutant flips it to `const: true`, which
// would accept logger:true and reject logger:false.
test("inputOutputLoggerValidateOptions accepts logger:false and rejects logger:true", () => {
	inputOutputLoggerValidateOptions({ logger: false });
	try {
		inputOutputLoggerValidateOptions({ logger: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("logger"));
	}
});

// L96 `if (!Array.isArray(path)) path = path.split(".")`. Mutant forces the
// branch true and would `.split` an array. omitPaths entries may already be
// arrays (pre-split), which must work as a path.
test("It should accept pre-split array omitPaths entries", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: [["event", "foo"]],
		}),
	);
	const event = { foo: "foo", bar: "bar" };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { bar: "bar" } }]);
});

// L99 prototype-pollution guard `path.includes("constructor")`. Mutant changes
// it to `path.includes("")`, so a literal `constructor` key would be omitted
// instead of skipped. The guard must skip it, leaving the key in place.
test("It should skip an omitPath containing the constructor segment", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.constructor"],
		}),
	);
	const event = { foo: "bar" };
	// Own enumerable `constructor` key that still equals Object, so the payload
	// stays a plain object (isPlainObject passes) and would be omitted if the
	// guard did not skip the `constructor` segment.
	Object.defineProperty(event, "constructor", {
		value: Object,
		enumerable: true,
		configurable: true,
		writable: true,
	});
	await handler(event, defaultContext);
	ok(Object.hasOwn(logger.mock.calls[0].arguments[0].event, "constructor"));
});

// L100 prototype-pollution guard `path.includes("prototype")`. Mutant changes
// it to `path.includes("")`, so a literal `prototype` key would be omitted
// instead of skipped.
test("It should skip an omitPath containing the prototype segment", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.prototype"],
		}),
	);
	const event = { foo: "bar", prototype: "own-prototype" };
	await handler(event, defaultContext);
	strictEqual(
		logger.mock.calls[0].arguments[0].event.prototype,
		"own-prototype",
	);
});

// L110 buildPathTree leaf reduce returns `true`. Mutant returns `false`, so a
// deeper sibling omit path under the same parent would lose its leaf marker.
// Two paths sharing a parent: `event.a.b` then `event.a.c`. The reduce return
// value seeds the next path's reduce only when paths share structure; assert
// both nested leaves are omitted.
test("It should omit multiple nested leaves under a shared parent", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.a.b", "event.a.c"],
		}),
	);
	const event = { a: { b: 1, c: 2, d: 3 } };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event: { a: { d: 3 } } }]);
});

// L120 omit `if (!pathTree) return obj`. Mutant forces it false, so a cold
// subtree (falsy pathTree) continues into array handling: omitArray would read
// `undefined["[]"]` and throw. With an array response that has no omit path,
// the guard must short-circuit and return the array unchanged.
test("It should return an array value unchanged when no path tree applies", async (t) => {
	const logger = t.mock.fn();
	const handler = middy(() => [1, 2, 3]).use(
		inputOutputLogger({
			logger,
			// Only `event` has an omit path; `response` pathTree is undefined.
			omitPaths: ["event.foo"],
		}),
	);
	const response = await handler({ foo: "x" }, defaultContext);
	deepStrictEqual(response, [1, 2, 3]);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: [1, 2, 3] }]);
});

// L127 omitArray `if (!childTree) return arr`. Mutant forces it false. An array
// pathTree with no `[]` child means the array must be returned unchanged.
test("It should return an array unchanged when no [] child path applies", async (t) => {
	const logger = t.mock.fn();
	// `event.list.x` makes `list` a nested object tree (no `[]` child), but the
	// value is an array, so omitArray gets childTree === undefined.
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.list.x"],
		}),
	);
	const event = { list: [{ x: 1 }, { x: 2 }] };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
});

// L129 omitArray loop bound `i < l`. Mutant changes to `i <= l`, reading
// arr[l] (undefined) and omitting on it. Assert array elements are processed
// exactly and no extra trailing element is introduced.
// L131 `if (next !== arr[i])` and L132 copy-on-write. Use an array where some
// elements change and assert the original is untouched and clone is correct.
test("It should omit inside array elements without mutating the source array", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.list.[].secret"],
		}),
	);
	const list = [
		{ secret: "a", keep: 1 },
		{ keep: 2 },
		{ secret: "c", keep: 3 },
	];
	const event = { list };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{
			event: {
				list: [{ keep: 1 }, { keep: 2 }, { keep: 3 }],
			},
		},
	]);
	const logged = logger.mock.calls[0].arguments[0].event.list;
	// Exactly the original length (no off-by-one trailing element).
	strictEqual(logged.length, 3);
	// Source array and its elements were not mutated (copy-on-write).
	deepStrictEqual(list, [
		{ secret: "a", keep: 1 },
		{ keep: 2 },
		{ secret: "c", keep: 3 },
	]);
	ok(Object.hasOwn(list[0], "secret"));
});

// L131 omitArray `if (next !== arr[i])`. Mutant forces it true, slicing a clone
// even when no element changed. When the `[]` child path matches nothing on any
// element, omitArray must return the SAME array reference (no clone).
test("It should return the same array reference when no element is omitted", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			// `[]` child tree exists, but no element carries `secret`.
			omitPaths: ["event.list.[].secret"],
		}),
	);
	const list = [{ keep: 1 }, { keep: 2 }];
	const event = { list };
	await handler(event, defaultContext);
	// Nothing changed, so the original array is returned by reference.
	strictEqual(logger.mock.calls[0].arguments[0].event.list, list);
});

// L147 omitObject mask branch copy-on-write `if (clone === obj) clone = {...obj}`.
// Forcing it true re-spreads from the original on the second masked key, losing
// the first mask. Mask TWO keys on the same object and assert both are masked,
// and the source object is left unmutated.
test("It should mask multiple keys on one object without losing earlier masks", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.foo", "event.baz"],
			mask: "*****",
		}),
	);
	const event = { foo: "secret", baz: "secret2", bar: "bar" };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { foo: "*****", baz: "*****", bar: "bar" } },
	]);
	// Original object retains its real values (clone-on-write).
	deepStrictEqual(event, { foo: "secret", baz: "secret2", bar: "bar" });
});

// L149 delete branch `else if (Object.hasOwn(obj, key))`. Mutant forces it
// true, so a leaf omit path whose key is absent still clones (and deletes the
// absent key). When nothing is omitted, omit must return the SAME object
// reference (zero-allocation cold path); a spurious clone breaks that identity.
test("It should return the same object reference when the leaf key is absent", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.absent"],
		}),
	);
	const event = { foo: "foo" };
	await handler(event, defaultContext);
	// Real code: no own `absent` key, so no clone is made and the original
	// object is logged by reference. The forced-true mutant clones it.
	strictEqual(logger.mock.calls[0].arguments[0].event, event);
	ok(!Object.hasOwn(logger.mock.calls[0].arguments[0].event, "absent"));
});

// L156 omitObject nested branch copy-on-write `if (clone === obj) clone = {...obj}`.
// Forcing true re-spreads from the original on a second nested change (losing
// the first); the `!==`/false variants either never clone (mutating the source)
// or skip writing the change. Two nested sub-objects changed on one parent,
// with the source asserted unmutated, pins all three L156 mutants.
test("It should omit two nested subtrees on one object without losing changes or mutating source", async (t) => {
	const logger = t.mock.fn();
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.a.secret", "event.b.secret"],
		}),
	);
	const a = { secret: "sa", keep: "ka" };
	const b = { secret: "sb", keep: "kb" };
	const event = { a, b };
	await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { a: { keep: "ka" }, b: { keep: "kb" } } },
	]);
	// Source object and its nested subtrees untouched (copy-on-write).
	deepStrictEqual(a, { secret: "sa", keep: "ka" });
	deepStrictEqual(b, { secret: "sb", keep: "kb" });
	deepStrictEqual(event, {
		a: { secret: "sa", keep: "ka" },
		b: { secret: "sb", keep: "kb" },
	});
});

// L165 isPlainObject `typeof value === "object"` and `value.constructor === Object`.
// A non-object primitive at an omit path's parent must bypass omitObject, and a
// non-plain object (class instance) must not be treated as plain.
test("It should not treat primitives or class instances as plain objects when omitting", async (t) => {
	const logger = t.mock.fn();
	class Custom {
		constructor() {
			this.secret = "keep";
		}
	}
	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
			omitPaths: ["event.prim.secret", "event.inst.secret"],
		}),
	);
	const inst = new Custom();
	const event = { prim: 42, inst };
	await handler(event, defaultContext);
	// `prim` is a number (typeof !== object) and `inst` is a class instance
	// (constructor !== Object); neither is descended into, so both survive whole.
	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { prim: 42, inst } },
	]);
	strictEqual(logger.mock.calls[0].arguments[0].event.inst.secret, "keep");
});

// L70/L72 optional chaining on response?.body and L219 teeStream response?.body.
// onError path with a defined-but-bodyless response (not a stream) must not
// throw and must log the response directly.
test("It should log a plain non-stream response set in onError", async (t) => {
	const logger = t.mock.fn();
	const handler = middy(() => {
		throw new Error("boom");
	})
		.use(inputOutputLogger({ logger }))
		.onError((request) => {
			request.response = { recovered: true };
		});
	const event = { foo: "bar" };
	const response = await handler(event, defaultContext);
	deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { recovered: true } },
	]);
	deepStrictEqual(response, { recovered: true });
});

// L70/L72 `isNodeStream(response?.body)` / `isWebStream(response?.body)` optional
// chaining. When the response is null, `response.body` (mutant) throws; the
// optional chaining must guard it so a null response logs cleanly.
test("It should log a null response without throwing", async (t) => {
	const logger = t.mock.fn();
	const handler = middy(() => null).use(inputOutputLogger({ logger }));
	const response = await handler({ foo: "bar" }, defaultContext);
	strictEqual(response, null);
	deepStrictEqual(logger.mock.calls[1].arguments, [{ response: null }]);
});

// L219 teeStream `!!request.response?.body` and L226
// `if (hasBody) request.response.body = piped`. When the response IS a bare
// stream (no .body), the teed stream is reattached to request.response, and the
// logged response is the decoded body (not an object wrapper). Covered by the
// existing ReadableStream tests, but assert reattachment explicitly here for a
// bodyless stream so the L219 chaining and the L226 else-branch are pinned.
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
	).use(inputOutputLogger({ logger }));
	let chunkResponse = "";
	const responseStream = createWritableStream((chunk) => {
		chunkResponse += chunk;
	});
	await handler({}, responseStream, defaultContext);
	// L226: piped (teed) stream reattached to .body so the streamed output is
	// the teed stream; the captured body is logged with the wrapper preserved.
	strictEqual(chunkResponse, input);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { statusCode: 201, body: input } },
	]);
});

// L257 makeWebTee decodeWebChunk `if (typeof chunk === "string") return chunk`.
// Mutant forces it false (or blanks the compared string), so a string chunk
// would be coerced via String()/decoder instead of passed through. Stream a
// string chunk and assert it is logged unchanged.
test("It should pass string chunks through a Web Stream unchanged", async (t) => {
	const logged = [];
	const logger = (data) => {
		logged.push(data);
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
	).use(inputOutputLogger({ logger }));
	const responseStream = createWritableStream(() => {});
	await handler({}, responseStream, defaultContext);
	strictEqual(logged[1].response, input);
});
