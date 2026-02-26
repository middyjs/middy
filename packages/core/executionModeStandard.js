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

		const response = await runRequest(
			request,
			beforeMiddlewares,
			lambdaHandler,
			afterMiddlewares,
			onErrorMiddlewares,
			plugin,
		);
		await plugin.requestEnd(request);
		return response;
	};
	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};
