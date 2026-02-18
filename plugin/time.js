// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { PerformanceObserver, performance } from "node:perf_hooks";

const perfObserver = new PerformanceObserver((items) => {});

perfObserver.observe({ entryTypes: ["measure"] });

const defaults = {
	logger: console.log,
	enabled: true,
};

const timePlugin = (opts = {}) => {
	const { logger, enabled } = { ...defaults, ...opts };
	if (!enabled) {
		return {};
	}

	let cold = true;
	const store = {};

	const start = (id) => {
		performance.mark(`${id}-start`);
	};
	const stop = (id) => {
		performance.mark(`${id}-end`);
		const measure = performance.measure(id, `${id}-start`, `${id}-end`);
		store[id] = measure.duration;
		logger(id, measure.duration, "ms");
	};

	// Only run during cold start
	const beforePrefetch = () => {
		start("prefetch");
	};
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
	const requestEnd = () => {
		stop("request");
		// clean up
		const ids = Object.keys(store);
		const marks = ids.flatMap((id) => [`${id}-start`, `${id}-end`]);
		performance.clearMarks(marks);
		performance.clearMeasures(ids);
	};

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
export default timePlugin;
