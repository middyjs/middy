// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { setTimeout } from "node:timers";
import { isExecutionModeDurable, validateOptions } from "@middy/util";
import { executionModeStandard } from "./executionModeStandard.js";

const name = "core";
const pkg = `@middy/${name}`;

// Marks the context whose middleware/handler stack is running, pointing at
// that request's namespace. A middy invoked from inside it (a router's route
// handler, a batch record handler) gets a context derived from the outer one,
// so reads fall through to the outer values while its own writes, and those of
// concurrent siblings, never touch the outer context. The mark is cleared when
// the stack settles, so a reused context starts fresh on the next invocation.
// A symbol on the context costs ~nothing; a WeakSet added ~80ns/invocation.
const inFlight = Symbol("middy.inFlight");

const noop = () => {};
const defaultPluginConfig = {
	timeoutEarlyInMillis: 5,
	timeoutEarlyResponse: () => {
		const err = new Error("[AbortError]: The operation was aborted.", {
			cause: { package: pkg },
		});
		err.name = "TimeoutError";
		throw err;
	},
	executionMode: executionModeStandard,
};

// JSON-Schema for `pluginConfig` passed to `middy(handler, pluginConfig)`.
// All options are optional; `additionalProperties: false` catches typos
// (e.g. `timeoutEarlyMillis` instead of `timeoutEarlyInMillis`).
// Properties listed in hook execution order.
const optionSchema = {
	type: "object",
	properties: {
		// Pre-computed request state seeded into `request.internal`.
		internal: { type: "object", additionalProperties: true },
		// Lifecycle hooks (see docs/intro/hooks).
		beforePrefetch: { instanceof: "Function" },
		requestStart: { instanceof: "Function" },
		beforeMiddleware: { instanceof: "Function" },
		afterMiddleware: { instanceof: "Function" },
		beforeHandler: { instanceof: "Function" },
		afterHandler: { instanceof: "Function" },
		requestEnd: { instanceof: "Function" },
		// Early-timeout configuration. `timeoutEarlyInMillis` reserves N ms
		// before Lambda timeout for `timeoutEarlyResponse` to run.
		timeoutEarlyInMillis: { type: "integer", minimum: 0 },
		timeoutEarlyResponse: { instanceof: "Function" },
		// Execution mode (standard, durable-context, streamify-response, or custom).
		executionMode: { instanceof: "Function" },
	},
	required: [],
	additionalProperties: false,
};

export const middyValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

export const middy = (setupLambdaHandler, pluginConfig) => {
	let lambdaHandler;
	let plugin;
	// Allow base handler to be set using .handler()
	if (typeof setupLambdaHandler === "function") {
		lambdaHandler = setupLambdaHandler;
		plugin = { ...pluginConfig };
	} else {
		lambdaHandler = noop;
		plugin = { ...setupLambdaHandler };
	}
	// Per-key rather than a defaults spread, so an explicit `undefined` still
	// falls back to the default. `null` is kept: `timeoutEarlyInMillis: null`
	// disables the early timeout, as it always has.
	for (const key in defaultPluginConfig) {
		if (plugin[key] === undefined) plugin[key] = defaultPluginConfig[key];
	}
	plugin.timeoutEarly = plugin.timeoutEarlyInMillis > 0;

	// Pre-compute single-call plugin hooks as noop to avoid optional chaining
	plugin.requestStart ??= noop;
	plugin.requestEnd ??= noop;
	plugin.beforeHandler ??= noop;
	plugin.afterHandler ??= noop;

	plugin.beforePrefetch?.();
	const beforeMiddlewares = [];
	const afterMiddlewares = [];
	const onErrorMiddlewares = [];

	const middyRequest = (event = {}, context = {}) => {
		const parent = context.middyContext;
		if (parent !== undefined && context[inFlight] === parent) {
			context = Object.create(context);
			context.middyContext = Object.create(parent);
		} else {
			context.middyContext = Object.create(null);
		}
		return {
			event,
			context,
			response: undefined,
			error: undefined,
			internal: plugin.internal
				? Object.assign(Object.create(null), plugin.internal)
				: Object.create(null),
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
		const befores = [];
		const afters = [];
		const onErrors = [];
		for (const middleware of middlewares) {
			const { before, after, onError } = middleware;
			if (!before && !after && !onError) {
				throw new Error(
					'Middleware must be an object containing at least one key among "before", "after", "onError"',
					{
						cause: { package: pkg },
					},
				);
			}
			if (before) befores.push(before);
			if (after) afters.push(after);
			if (onError) onErrors.push(onError);
		}
		beforeMiddlewares.push(...befores);
		afterMiddlewares.unshift(...afters.reverse());
		onErrorMiddlewares.unshift(...onErrors.reverse());
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
	const beforeMiddlewareHook = plugin.beforeMiddleware;
	const afterMiddlewareHook = plugin.afterMiddleware;
	// Captured now, so the mark is cleared on this request's own context.
	const { context } = request;
	context[inFlight] = context.middyContext;

	try {
		for (let i = 0, len = beforeMiddlewares.length; i < len; i++) {
			const nextMiddleware = beforeMiddlewares[i];
			if (beforeMiddlewareHook) beforeMiddlewareHook(nextMiddleware.name);
			let res = nextMiddleware(request);
			if (res instanceof Promise) res = await res;
			if (afterMiddlewareHook) afterMiddlewareHook(nextMiddleware.name);
			// short circuit chaining and respond early
			if (typeof res !== "undefined") {
				request.earlyResponse = res;
			}
			// earlyResponse pattern added in 6.0.0 to handle undefined values
			if ("earlyResponse" in request) {
				request.response = request.earlyResponse;
				break;
			}
		}

		// Check if before stack hasn't exit early
		if (!("earlyResponse" in request)) {
			plugin.beforeHandler();

			// Per-request AbortController: scoping it here keeps nested middy
			// calls and concurrent invocations (workers/non-Lambda hosts) from
			// aborting each other's signals.
			const handlerAbort = new AbortController();
			const abortOpts = { signal: handlerAbort.signal };

			// clearTimeout pattern is ~24x faster than timers/promises + AbortController
			// Note: signal.abort is slow ~3_500ns
			const handlerResult = lambdaHandler(
				request.event,
				request.context,
				abortOpts,
			);
			// Any thenable, not only a native Promise: lazy thenables such as the
			// durable SDK's DurablePromise only run once then() is called.
			// Middleware results stay real-Promise-only.
			if (typeof handlerResult?.then === "function") {
				if (timeoutEarly) {
					let timeoutResolve;
					const timeoutPromise = new Promise((resolve, reject) => {
						timeoutResolve = () => {
							handlerAbort.abort();
							try {
								resolve(plugin.timeoutEarlyResponse());
							} catch (err) {
								reject(err);
							}
						};
					});
					// Clamp to [0, 2^31-1]: when remaining Lambda time is below
					// timeoutEarlyInMillis the raw delay is negative, which would emit
					// a TimeoutNegativeWarning (a 0ms delay fires on the next tick).
					// Above 2^31-1 Node emits TimeoutOverflowWarning and fires after
					// 1ms; non-Lambda hosts (ECS) can report remaining times that large.
					timeoutID = setTimeout(
						timeoutResolve,
						Math.min(
							2147483647,
							Math.max(
								0,
								getRemainingTimeInMillis() - plugin.timeoutEarlyInMillis,
							),
						),
					);
					request.response = await Promise.race([
						handlerResult,
						timeoutPromise,
					]);
				} else {
					request.response = await handlerResult;
				}
			} else {
				request.response = handlerResult;
			}

			if (timeoutID) {
				clearTimeout(timeoutID);
			}

			plugin.afterHandler();
			for (let i = 0, len = afterMiddlewares.length; i < len; i++) {
				const nextMiddleware = afterMiddlewares[i];
				if (beforeMiddlewareHook) beforeMiddlewareHook(nextMiddleware.name);
				let res = nextMiddleware(request);
				if (res instanceof Promise) res = await res;
				if (afterMiddlewareHook) afterMiddlewareHook(nextMiddleware.name);
				if (typeof res !== "undefined") {
					request.earlyResponse = res;
				}
				if ("earlyResponse" in request) {
					request.response = request.earlyResponse;
					break;
				}
			}
		}
	} catch (err) {
		// timeout should be aborted when errors happen in handler
		if (timeoutID) {
			clearTimeout(timeoutID);
		}

		request.response = undefined;
		delete request.earlyResponse;
		request.error = err;

		if (isExecutionModeDurable(request.context)) {
			throw request.error;
		}

		try {
			for (let i = 0, len = onErrorMiddlewares.length; i < len; i++) {
				const nextMiddleware = onErrorMiddlewares[i];
				if (beforeMiddlewareHook) beforeMiddlewareHook(nextMiddleware.name);
				let res = nextMiddleware(request);
				if (res instanceof Promise) res = await res;
				if (afterMiddlewareHook) afterMiddlewareHook(nextMiddleware.name);
				if (typeof res !== "undefined") {
					request.earlyResponse = res;
				}
				if ("earlyResponse" in request) {
					request.response = request.earlyResponse;
					break;
				}
			}
		} catch (err) {
			if (err !== request.error) {
				request.error = new AggregateError(
					[request.error, err],
					"Error thrown in onError middleware",
					{ cause: { package: pkg } },
				);
			}

			throw request.error;
		}
		// Catch if onError stack hasn't handled the error
		if (typeof request.response === "undefined") throw request.error;
	} finally {
		context[inFlight] = undefined;
	}

	return request.response;
};

export default middy;
