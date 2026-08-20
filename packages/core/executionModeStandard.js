// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

export const executionModeStandard = (
	{ middyRequest, runRequest },
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	const middy = async (event, context) => {
		const request = middyRequest(event, context);
		plugin.requestStart(request);
		// Run requestEnd without letting a throw in the hook replace the
		// handler's original error. If only requestEnd throws, it propagates
		// (same as a naive finally). If both throw, the hook error is attached
		// as `.cause` on the handler error (only if no cause is already set).
		// `hasError` (not truthiness) tracks the catch so thrown falsy
		// primitives (null, "", 0) still reject instead of resolving.
		let handlerError;
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
			handlerError = err;
			hasError = true;
		}
		try {
			const requestEndResult = plugin.requestEnd(request);
			if (requestEndResult instanceof Promise) await requestEndResult;
		} catch (hookErr) {
			if (hasError) {
				// Primitives can't carry properties (assignment throws in strict
				// mode); keep the handler error and drop the hook error.
				if (typeof handlerError === "object" && handlerError !== null) {
					handlerError.cause ??= hookErr;
				}
			} else {
				throw hookErr;
			}
		}
		if (hasError) throw handlerError;
		return response;
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};
