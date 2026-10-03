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
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};
