// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	isWarmingUp: (event) => event.source === "serverless-plugin-warmup",
};

const warmupMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const warmupMiddlewareBefore = (request) => {
		if (options.isWarmingUp(request.event)) {
			return "warmup";
		}
	};

	return {
		before: warmupMiddlewareBefore,
	};
};

export default warmupMiddleware;
