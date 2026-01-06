import { setTimeout } from "node:timers";
import { executionModeStandard } from "./executionModeStandard.js";

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
	executionMode: executionModeStandard,
};

export const middy = (setupLambdaHandler, pluginConfig) => {
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

	const middy = plugin.executionMode(
		{ middyRequest, runRequest },
		beforeMiddlewares,
		lambdaHandler,
		afterMiddlewares,
		onErrorMiddlewares,
		plugin,
	);

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
					{
						cause: { package: "@middy/core" },
					},
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

	return middy;
};

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
	const getRemainingTimeInMillis =
		request.context.getRemainingTimeInMillis ||
		request.context.lambdaContext?.getRemainingTimeInMillis;
	const timeoutEarly = plugin.timeoutEarly && getRemainingTimeInMillis;

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
			// Required --test-force-exit to ignore unresolved timeoutPromise
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
					getRemainingTimeInMillis() - plugin.timeoutEarlyInMillis,
				);
				promises.push(timeoutPromise);
			}
			request.response = await Promise.race(promises);

			if (timeoutID) {
				clearTimeout(timeoutID);
			} // alt varient for when abort() is faster
			// if (timeoutEarly) {
			// 	const timeoutPromise = setTimeoutPromise(
			// 		() => {
			// 		  handlerAbort.abort();
			// 		  plugin.timeoutEarlyResponse()
			// 		},
			// 		getRemainingTimeInMillis() - plugin.timeoutEarlyInMillis,
			// 		{
			// 			signal: handlerAbort.signal,
			// 		}
			// 	);
			// 	promises.push(timeoutPromise);
			// }
			// request.response = await Promise.race(promises);
			// handlerAbort.abort(); // abort timeout

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

const runMiddlewares = async (request, middlewares, pluginConfig) => {
	for (const nextMiddleware of middlewares) {
		pluginConfig.beforeMiddleware?.(nextMiddleware.name);
		const res = await nextMiddleware(request);
		pluginConfig.afterMiddleware?.(nextMiddleware.name);
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
