// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { withDurableExecution } from "@aws/durable-execution-sdk-js";
import { lambdaContextKeys } from "@middy/util";
import { timeoutEarlyTimers } from "./timeoutEarlyTimers.js";

const durableContextKeys = [...lambdaContextKeys, "getRemainingTimeInMillis"];

export const executionModeDurableContext = (
	{ middyRequest, runRequest },
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	const durableHandler = withDurableExecution(async (event, context) => {
		const request = middyRequest(event, context);

		// normalize context with executionModeStandard, before requestStart so
		// the hook sees the same context shape as in the other modes.
		// https://docs.aws.amazon.com/lambda/latest/dg/typescript-context.html
		// The SDK keeps the Lambda context (including `tenantId`, which it reads
		// from there itself) under `lambdaContext`; `executionContext` only
		// carries `durableExecutionArn`.
		// Idea: Use Proxy instead of copying. Faster for common use case?
		copyKeys(
			request.context,
			request.context.lambdaContext,
			durableContextKeys,
		);
		plugin.requestStart(request);

		// Run requestEnd, then rethrow the request error. `hasError` (not
		// truthiness) tracks the catch so thrown falsy primitives still reject.
		let requestError;
		let hasError = false;
		let response;
		try {
			response = await runRequest(
				request,
				beforeMiddlewares,
				lambdaHandler,
				afterMiddlewares,
				onErrorMiddlewares,
				plugin,
			);
		} catch (err) {
			requestError = err;
			hasError = true;
		}
		try {
			const requestEndResult = plugin.requestEnd(request);
			if (requestEndResult instanceof Promise) await requestEndResult;
		} catch (hookErr) {
			if (!hasError) throw hookErr;
			// Keep both errors: attaching the hook error as `.cause` was silently
			// dropped for middy errors (they carry cause:{package}) and threw a
			// TypeError on frozen errors.
			throw new AggregateError(
				[requestError, hookErr],
				"Error thrown in requestEnd hook",
				{ cause: { package: "@middy/core" } },
			);
		}
		if (hasError) throw requestError;
		return response;
	});
	// When the SDK suspends an invocation (a wait, a callback, a step retry) it
	// answers Lambda without ever settling the handler promise, so the request
	// never reaches the point where it clears its own early-timeout timer. Left
	// armed, that timer would fire into a later invocation of the same
	// execution environment.
	// https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-sdk-retries.html
	const middy = async (event, lambdaContext) => {
		const timers = new Set();
		lambdaContext[timeoutEarlyTimers] = timers;
		try {
			return await durableHandler(event, lambdaContext);
		} finally {
			timers.forEach(clearTimeout);
		}
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};

const copyKeys = (to, from, keys) => {
	for (let i = 0, len = keys.length; i < len; i++) {
		to[keys[i]] = from[keys[i]];
	}
};
