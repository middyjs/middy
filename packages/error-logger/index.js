// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const defaults = {
	logger: ({ error }) => console.error(error),
};

const optionSchema = {
	logger: "function?",
};

export const errorLoggerValidateOptions = (options) =>
	validateOptions("@middy/error-logger", optionSchema, options);

const errorLoggerMiddleware = (opts = {}) => {
	let { logger } = { ...defaults, ...opts };
	if (typeof logger !== "function") logger = null;

	const errorLoggerMiddlewareOnError = (request) => {
		logger(request);
	};
	return {
		onError: logger ? errorLoggerMiddlewareOnError : undefined,
	};
};
export default errorLoggerMiddleware;
