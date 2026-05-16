import { Writable } from "node:stream";
import { Bench } from "tinybench";
import { executionModeStreamifyResponse } from "./executionModeStreamifyResponse.js";
import middy from "./index.js";

const DELIMITER_LEN = 8;
globalThis.awslambda = {
	streamifyResponse: (cb) => cb,
	HttpResponseStream: {
		from: (underlyingStream, prelude) => {
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
			underlyingStream._onBeforeFirstWrite = () => {
				const metadataPrelude = JSON.stringify(prelude);
				underlyingStream.write(metadataPrelude);
				underlyingStream.write(new Uint8Array(DELIMITER_LEN));
			};
			return wrapStream();
		},
	},
};

function createResponseStreamMock() {
	const chunks = [];
	const responseStream = new Writable({
		write(chunk, encoding, callback) {
			chunks.push(chunk);
			callback();
		},
	});
	return responseStream;
}

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const middleware = (opts = {}) => {
	const middlewareBefore = (request) => {};
	const middlewareAfter = (request) => {};
	const middlewareOnError = (request) => {
		if (request.response !== undefined) return;
		middlewareAfter(request);
	};
	return {
		before: middlewareBefore,
		after: middlewareAfter,
		onError: middlewareOnError,
	};
};
const middlewareAsync = (opts = {}) => {
	const middlewareBefore = async (request) => {};
	const middlewareAfter = async (request) => {};
	const middlewareOnError = async (request) => {
		if (request.response !== undefined) return;
		await middlewareAfter(request);
	};
	return {
		before: middlewareBefore,
		after: middlewareAfter,
		onError: middlewareOnError,
	};
};
const baseHandler = () => {};
const baseHandlerAsync = async () => {};
const streamHandler = (event, context) => {
	return "chunk1chunk2chunk3";
};
const streamBodySmall = "x".repeat(256);
const streamBodyMedium = "x".repeat(16 * 1024);
const streamBodyLarge = "x".repeat(1024 * 1024);
const streamBodyHuge = "x".repeat(10 * 1024 * 1024);
const streamHandlerSmall = () => streamBodySmall;
const streamHandlerMedium = () => streamBodyMedium;
const streamHandlerLarge = () => streamBodyLarge;
const streamHandlerHuge = () => streamBodyHuge;
const streamHandlerPreludeSmall = () => ({
	statusCode: 200,
	headers: { "Content-Type": "text/plain" },
	body: streamBodySmall,
});
const streamHandlerPreludeLarge = () => ({
	statusCode: 200,
	headers: { "Content-Type": "text/plain" },
	body: streamBodyLarge,
});
const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const warmHandler = middy().handler(baseHandler);
const warmAsyncHandler = middy().handler(baseHandlerAsync);
const middlewares = new Array(25);
middlewares.fill(middleware());
const warmMiddlewareHandler = middy().use(middlewares).handler(baseHandler);
const middlewaresAsync = new Array(25);
middlewaresAsync.fill(middlewareAsync());
const warmAsyncMiddlewareHandler = middy()
	.use(middlewaresAsync)
	.handler(baseHandler);
const warmDisableTimeoutHandler = middy({ timeoutEarlyInMillis: 0 }).handler(
	baseHandler,
);
const warmStreamHandler = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandler);
const warmStreamHandlerSmall = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerSmall);
const warmStreamHandlerMedium = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerMedium);
const warmStreamHandlerLarge = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerLarge);
const warmStreamHandlerHuge = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerHuge);
const warmStreamHandlerPreludeSmall = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerPreludeSmall);
const warmStreamHandlerPreludeLarge = middy({
	executionMode: executionModeStreamifyResponse,
}).handler(streamHandlerPreludeLarge);

const defaultEvent = {};
await bench
	.add("Cold Invocation", async () => {
		const coldHandler = middy().handler(baseHandler);
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})
	.add("Cold Invocation with middleware", async () => {
		const middlewares = new Array(25);
		middlewares.fill(middleware());
		const coldHandler = middy().use(middlewares).handler(baseHandler);
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})
	.add("Warm Invocation", async () => {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})
	.add("Warm Async Invocation", async () => {
		await warmAsyncHandler(defaultEvent, defaultContext);
	})
	.add("Warm Invocation with disabled Timeout", async () => {
		await warmDisableTimeoutHandler(defaultEvent, defaultContext);
	})
	.add("Warm Invocation with middleware", async () => {
		await warmMiddlewareHandler(defaultEvent, defaultContext);
	})
	.add("Warm Invocation with async middleware", async () => {
		await warmAsyncMiddlewareHandler(defaultEvent, defaultContext);
	})
	.add("Warm Invocation with streamifyResponse", async () => {
		await warmStreamHandler(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("Cold Invocation with streamifyResponse", async () => {
		const coldStreamHandler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(streamHandler);
		await coldStreamHandler(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse string 256B", async () => {
		await warmStreamHandlerSmall(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse string 16KB", async () => {
		await warmStreamHandlerMedium(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse string 1MB", async () => {
		await warmStreamHandlerLarge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse string 10MB", async () => {
		await warmStreamHandlerHuge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse prelude+string 256B", async () => {
		await warmStreamHandlerPreludeSmall(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})
	.add("streamifyResponse prelude+string 1MB", async () => {
		await warmStreamHandlerPreludeLarge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	})

	.run();

console.table(bench.table());
