// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { executionContextKeys, lambdaContextKeys } from "@middy/util";

let withDurableExecution;
try {
	({ withDurableExecution } = await import("@aws/durable-execution-sdk-js"));
} catch {
	withDurableExecution = undefined;
}

export const executionModeDurableContext = (
	{ middyRequest, runRequest },
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	if (!withDurableExecution) {
		throw new Error(
			"executionModeDurableContext requires @aws/durable-execution-sdk-js. " +
				"Install it as a dependency: npm i @aws/durable-execution-sdk-js",
		);
	}

	const middy = withDurableExecution(async (event, context) => {
		const request = middyRequest(event, context);
		plugin.requestStart(request);
		copyKeys(
			request.context,
			request.context.executionContext,
			executionContextKeys,
		);
		copyKeys(request.context, request.context.lambdaContext, lambdaContextKeys);
		try {
			const response = await runRequest(
				request,
				beforeMiddlewares,
				lambdaHandler,
				afterMiddlewares,
				onErrorMiddlewares,
				plugin,
			);
			return response;
		} finally {
			await plugin.requestEnd(request);
		}
	});

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
