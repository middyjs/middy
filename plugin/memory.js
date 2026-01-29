// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import memwatch from "@airbnb/node-memwatch";

const defaults = {
	logger: console.log,
	enabled: true,
};

const memoryPlugin = (opts = {}) => {
	const { logger, enabled } = { ...defaults, ...opts };
	if (!enabled) {
		return {};
	}

	let cold = true;
	const store = {};

	const start = (id) => {
		store[id] = new memwatch.HeapDiff();
	};
	const stop = (id) => {
		logger(id, store[id].end());
	};

	const beforePrefetch = () => start("prefetch");
	const requestStart = () => {
		if (cold) {
			cold = false;
			stop("prefetch");
		}
		start("request");
	};
	const beforeMiddleware = start;
	const afterMiddleware = stop;
	const beforeHandler = () => start("handler");
	const afterHandler = () => stop("handler");
	const requestEnd = () => stop("request");

	return {
		beforePrefetch,
		requestStart,
		beforeMiddleware,
		afterMiddleware,
		beforeHandler,
		afterHandler,
		requestEnd,
	};
};
export default memoryPlugin;
