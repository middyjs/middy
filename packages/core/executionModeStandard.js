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
		let handlerError;
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
		}
		try {
			await plugin.requestEnd(request);
		} catch (hookErr) {
			if (handlerError) {
				handlerError.cause ??= hookErr;
			} else {
				throw hookErr;
			}
		}
		if (handlerError) throw handlerError;
		return response;
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};
