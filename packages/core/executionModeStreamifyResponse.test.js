import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
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
		strictEqual(e.message, "handler response not a Readable or ReadableStream");
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
			return pipejoin([createReadableStream(input), createPassThroughStream()]);
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

// plugin

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
