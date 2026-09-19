import { bench } from "node:bench";
import { Writable } from "node:stream";
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

// Invocations per measured sample. Payload-heavy streaming cases use their own
// smaller count so a single sample stays in the same millisecond ballpark.
const operations = 1_000;

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

bench("core: Cold Invocation", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		const coldHandler = middy().handler(baseHandler);
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("core: Cold Invocation with middleware", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		const middlewares = new Array(25);
		middlewares.fill(middleware());
		const coldHandler = middy().use(middlewares).handler(baseHandler);
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("core: Warm Invocation", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("core: Warm Async Invocation", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmAsyncHandler(defaultEvent, defaultContext);
	}
	b.end(operations);
});

bench("core: Warm Invocation with disabled Timeout", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmDisableTimeoutHandler(defaultEvent, defaultContext);
	}
	b.end(operations);
});

bench("core: Warm Invocation with middleware", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmMiddlewareHandler(defaultEvent, defaultContext);
	}
	b.end(operations);
});

bench("core: Warm Invocation with async middleware", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmAsyncMiddlewareHandler(defaultEvent, defaultContext);
	}
	b.end(operations);
});

bench("core: Warm Invocation with streamifyResponse", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmStreamHandler(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(operations);
});

bench("core: Cold Invocation with streamifyResponse", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		const coldStreamHandler = middy({
			executionMode: executionModeStreamifyResponse,
		}).handler(streamHandler);
		await coldStreamHandler(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(operations);
});

bench("core: streamifyResponse string 256B", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmStreamHandlerSmall(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(operations);
});

bench("core: streamifyResponse string 16KB", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmStreamHandlerMedium(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(operations);
});

bench("core: streamifyResponse string 1MB", async (b) => {
	const megabyteOperations = 100;
	b.start();
	for (let i = 0; i < megabyteOperations; i++) {
		await warmStreamHandlerLarge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(megabyteOperations);
});

bench("core: streamifyResponse string 10MB", async (b) => {
	const tenMegabyteOperations = 10;
	b.start();
	for (let i = 0; i < tenMegabyteOperations; i++) {
		await warmStreamHandlerHuge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(tenMegabyteOperations);
});

bench("core: streamifyResponse prelude+string 256B", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmStreamHandlerPreludeSmall(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(operations);
});

bench("core: streamifyResponse prelude+string 1MB", async (b) => {
	const megabyteOperations = 100;
	b.start();
	for (let i = 0; i < megabyteOperations; i++) {
		await warmStreamHandlerPreludeLarge(
			defaultEvent,
			createResponseStreamMock(),
			defaultContext,
		);
	}
	b.end(megabyteOperations);
});
