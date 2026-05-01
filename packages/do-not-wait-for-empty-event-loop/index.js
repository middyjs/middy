// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { isExecutionModeDurable, validateOptions } from "@middy/util";

const name = "do-not-wait-for-empty-event-loop";
const pkg = `@middy/${name}`;

const defaults = {
	runOnBefore: true,
	runOnAfter: false,
	runOnError: false,
};

const optionSchema = {
	type: "object",
	properties: {
		runOnBefore: { type: "boolean" },
		runOnAfter: { type: "boolean" },
		runOnError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const doNotWaitForEmptyEventLoopValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

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
