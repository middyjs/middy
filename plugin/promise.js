// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createHook } from "node:async_hooks";

const defaults = {
	logger: console.log,
	enabled: true,
};

let count = 0;
const hook = createHook({
	init(asyncId, type) {
		if (type === "PROMISE") {
			count++;
		}
	},
});

const promisePlugin = (opts = {}) => {
	const { logger, enabled } = { ...defaults, ...opts };
	if (!enabled) {
		return {};
	}
	hook.enable();

	let cold = true;
	const store = {};
	const start = (id) => {
		store[id] = count;
	};
	const stop = (id) => {
		logger(id, count - store[id]);
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
export default promisePlugin;
