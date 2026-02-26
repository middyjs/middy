// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { isExecutionModeDurable } from "@middy/util";

const defaults = {
	runOnBefore: true,
	runOnAfter: false,
	runOnError: false,
};

const doNotWaitForEmptyEventLoopMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const doNotWaitForEmptyEventLoop = (request) => {
		if (isExecutionModeDurable(request.context)) {
			request.context.lambdaContext.callbackWaitsForEmptyEventLoop = false;
		} else {
			request.context.callbackWaitsForEmptyEventLoop = false;
		}
	};

	return {
		before: options.runOnBefore ? doNotWaitForEmptyEventLoop : undefined,
		after: options.runOnAfter ? doNotWaitForEmptyEventLoop : undefined,
		onError: options.runOnError ? doNotWaitForEmptyEventLoop : undefined,
	};
};
export default doNotWaitForEmptyEventLoopMiddleware;
