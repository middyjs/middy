/* global awslambda */
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import { setTimeout } from "node:timers";

const defaultLambdaHandler = () => {};
const defaultPluginConfig = {
	timeoutEarlyInMillis: 5,
	timeoutEarlyResponse: () => {
		const err = new Error("[AbortError]: The operation was aborted.", {
			cause: { package: "@middy/core" },
		});
		err.name = "TimeoutError";
		throw err;
	},
	streamifyResponse: false, // Deprecate need for this when AWS provides a flag for when it's looking for it
};

const middy = (setupLambdaHandler, pluginConfig) => {
	let lambdaHandler;
	let plugin;
	// Allow base handler to be set using .handler()
	if (typeof setupLambdaHandler === "function") {
		lambdaHandler = setupLambdaHandler;
		plugin = { ...defaultPluginConfig, ...pluginConfig };
	} else {
		lambdaHandler = defaultLambdaHandler;
		plugin = { ...defaultPluginConfig, ...setupLambdaHandler };
	}
	plugin.timeoutEarly = plugin.timeoutEarlyInMillis > 0;

	plugin.beforePrefetch?.();
	const beforeMiddlewares = [];
	const afterMiddlewares = [];
	const onErrorMiddlewares = [];

	const middyRequest = (event = {}, context = {}) => {
		return {
			event,
			context,
			response: undefined,
			error: undefined,
			internal: plugin.internal ?? {},
		};
	};
	const middy = plugin.streamifyResponse
		? awslambda.streamifyResponse(
				async (event, lambdaResponseStream, context) => {
					const request = middyRequest(event, context);
					plugin.requestStart?.(request);
					const handlerResponse = await runRequest(
						request,
						beforeMiddlewares,
						lambdaHandler,
						afterMiddlewares,
						onErrorMiddlewares,
						plugin,
					);
					let responseStream = lambdaResponseStream;
					let handlerBody = handlerResponse;
					if (handlerResponse.statusCode) {
						const { body, ...restResponse } = handlerResponse;
						handlerBody = body ?? ""; // #1137
						responseStream = awslambda.HttpResponseStream.from(
							responseStream,
							restResponse,
						);
					}

					let handlerStream;
					if (
						handlerBody._readableState ||
						handlerBody instanceof ReadableStream
					) {
						handlerStream = handlerBody;
					} else if (typeof handlerBody === "string") {
						// #1189
						handlerStream = Readable.from(
							handlerBody.length < stringIteratorSize
								? handlerBody
								: stringIterator(handlerBody),
						);
					}

					if (!handlerStream) {
						throw new Error("handler response not a ReadableStream");
					}

					await pipeline(handlerStream, responseStream);
					await plugin.requestEnd?.(request);
				},
			)
		: async (event, context) => {
				const request = middyRequest(event, context);
				plugin.requestStart?.(request);

				const response = await runRequest(
					request,
					beforeMiddlewares,
					lambdaHandler,
					afterMiddlewares,
					onErrorMiddlewares,
					plugin,
				);
				await plugin.requestEnd?.(request);
				return response;
			};

	middy.use = (inputMiddleware) => {
		const middlewares = Array.isArray(inputMiddleware)
			? inputMiddleware
			: [inputMiddleware];
		for (const middleware of middlewares) {
			const { before, after, onError } = middleware;

			if (before || after || onError) {
				if (before) middy.before(before);
				if (after) middy.after(after);
				if (onError) middy.onError(onError);
			} else {
				throw new Error(
					'Middleware must be an object containing at least one key among "before", "after", "onError"',
				);
			}
		}
		return middy;
	};

	// Inline Middlewares
	middy.before = (beforeMiddleware) => {
		beforeMiddlewares.push(beforeMiddleware);
		return middy;
	};
	middy.after = (afterMiddleware) => {
		afterMiddlewares.unshift(afterMiddleware);
		return middy;
	};
	middy.onError = (onErrorMiddleware) => {
		onErrorMiddlewares.unshift(onErrorMiddleware);
		return middy;
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};

	return middy;
};

const stringIteratorSize = 16384; // 16 * 1024 // Node.js default
function* stringIterator(input) {
	let position = 0;
	const length = input.length;
	while (position < length) {
		yield input.substring(position, position + stringIteratorSize);
		position += stringIteratorSize;
	}
}

// shared AbortController, because it's slow
let handlerAbort = new AbortController();
const runRequest = async (
	request,
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	let timeoutID;
	// context.getRemainingTimeInMillis checked for when AWS context missing (tests, containers)
	const timeoutEarly =
		plugin.timeoutEarly && request.context.getRemainingTimeInMillis;

	try {
		await runMiddlewares(request, beforeMiddlewares, plugin);

		// Check if before stack hasn't exit early
		if (!Object.hasOwn(request, "earlyResponse")) {
			plugin.beforeHandler?.();

			// Can't manually abort and timeout with same AbortSignal
			// https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
			if (handlerAbort.signal.aborted) {
				handlerAbort = new AbortController();
			}
			const promises = [
				lambdaHandler(request.event, request.context, {
					signal: handlerAbort.signal,
				}),
			];

			// clearTimeout pattern is 10x faster than using AbortController
			// Note: signal.abort is slow ~6000ns
			if (timeoutEarly) {
				let timeoutResolve;
				const timeoutPromise = new Promise((resolve, reject) => {
					timeoutResolve = () => {
						handlerAbort.abort();
						try {
							resolve(plugin.timeoutEarlyResponse());
						} catch (e) {
							reject(e);
						}
					};
				});
				timeoutID = setTimeout(
					timeoutResolve,
					request.context.getRemainingTimeInMillis() -
						plugin.timeoutEarlyInMillis,
				);
				promises.push(timeoutPromise);
			}
			request.response = await Promise.race(promises);
			if (timeoutID) {
				clearTimeout(timeoutID);
			}

			plugin.afterHandler?.();
			await runMiddlewares(request, afterMiddlewares, plugin);
		}
	} catch (e) {
		// timeout should be aborted when errors happen in handler
		if (timeoutID) {
			clearTimeout(timeoutID);
		}

		// Reset response changes made by after stack before error thrown
		request.response = undefined;
		request.error = e;
		try {
			await runMiddlewares(request, onErrorMiddlewares, plugin);
		} catch (e) {
			// Save error that wasn't handled
			e.originalError = request.error;
			request.error = e;

			throw request.error;
		}
		// Catch if onError stack hasn't handled the error
		if (typeof request.response === "undefined") throw request.error;
	}

	return request.response;
};

const runMiddlewares = async (request, middlewares, plugin) => {
	for (const nextMiddleware of middlewares) {
		plugin.beforeMiddleware?.(nextMiddleware.name);
		const res = await nextMiddleware(request);
		plugin.afterMiddleware?.(nextMiddleware.name);
		// short circuit chaining and respond early
		if (typeof res !== "undefined") {
			request.earlyResponse = res;
		}
		// earlyResponse pattern added in 6.0.0 to handle undefined values
		if (Object.hasOwn(request, "earlyResponse")) {
			request.response = request.earlyResponse;
			return;
		}
	}
};

export default middy;
