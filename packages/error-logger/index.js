// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	logger: ({ error }) => console.error(error),
};

const errorLoggerMiddleware = (opts = {}) => {
	let { logger } = { ...defaults, ...opts };
	if (typeof logger !== "function") logger = null;

	const errorLoggerMiddlewareOnError = async (request) => {
		logger(request);
	};
	return {
		onError: logger ? errorLoggerMiddlewareOnError : null,
	};
};
export default errorLoggerMiddleware;
