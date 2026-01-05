import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { createReadableStream, createWritableStream } from "@datastream/core";
import middy, {
	//executionModeDurableContext,
	executionModeStreamifyResponse,
} from "../core/index.js";
import inputOutputLogger from "./index.js";

// Silence logging
// console.log = () => {}

// const event = {}
const context = {
	getRemainingTimeInMillis: () => 1000,
};
const defaultContext = context;

test("It should log event and response", async (t) => {
	const logger = t.mock.fn();

	const handler = middy((event) => event).use(
		inputOutputLogger({
			logger,
		}),
	);

	const event = { foo: "bar", fuu: "baz" };
	const response = await handler(event, context);

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
	const response = await handler(event, responseStream, context);
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
	const response = await handler(event, responseStream, context);
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
	const response = await handler(event, responseStream, context);
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
	const response = await handler(event, responseStream, context);
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

test("It should throw error when invalid logger", async (t) => {
	const logger = false;

	try {
		middy((event) => event).use(
			inputOutputLogger({
				logger,
			}),
		);
	} catch (e) {
		strictEqual(e.message, "logger must be a function");
	}
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
	const response = await handler(event, context);

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
	const response = await handler(event, context);

	deepStrictEqual(logger.mock.calls[0].arguments, [
		{ event: { foo: "*****", bar: "bar" } },
	]);
	deepStrictEqual(logger.mock.calls[1].arguments, [
		{ response: { foo: "foo", bar: "*****" } },
	]);

	deepStrictEqual(response, event);
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
	const response = await handler(event, context);

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
	const response = await handler(event, context);

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
	const response = await handler(event, context);

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
	const context = {
		executionContext: {
			requestId: "uuid",
			tenantId: "alpha",
		},
		lambdaContext: {
			...defaultContext,
			functionName: "test",
			awsRequestId: "xxxxx",
		},
		// mock Class
		constructor: {
			name: "DurableContextImpl",
		},
	};
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
	const response = await handler(event, context);

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
		await handler(event, context);
	} catch (e) {
		deepStrictEqual(logger.mock.calls[0].arguments, [{ event }]);
		strictEqual(logger.mock.callCount(), 1);
		strictEqual(e.message, "error");
	}
});
