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

const bench = new Bench({ time: 1_000 });

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

const event = {};
await bench
	.add("Cold Invocation", async () => {
		const coldHandler = middy().handler(baseHandler);
		try {
			await coldHandler(event, context);
		} catch (_e) {}
	})
	.add("Cold Invocation with middleware", async () => {
		const middlewares = new Array(25);
		middlewares.fill(middleware());
		const coldHandler = middy().use(middlewares).handler(baseHandler);
		try {
			await coldHandler(event, context);
		} catch (_e) {}
	})
	.add("Warm Invocation", async () => {
		try {
			await warmHandler(event, context);
		} catch (_e) {}
	})
	.add("Warm Async Invocation", async () => {
		await warmAsyncHandler(event, context);
	})
	.add("Warm Invocation with disabled Timeout", async () => {
		await warmDisableTimeoutHandler(event, context);
	})
	.add("Warm Invocation with middleware", async () => {
		await warmMiddlewareHandler(event, context);
	})
	.add("Warm Invocation with async middleware", async () => {
		await warmAsyncMiddlewareHandler(event, context);
	})
	.add("Warm Invocation with streamifyResponse", async () => {
		await warmStreamHandler(event, createResponseStreamMock(), context);
	})
	.add("Cold Invocation with streamifyResponse", async () => {
		const coldStreamHandler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(streamHandler);
		await coldStreamHandler(event, createResponseStreamMock(), context);
	})

	.run();

console.table(bench.table());
