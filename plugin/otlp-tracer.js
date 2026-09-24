import { context } from "@opentelemetry/api";

const defaults = {
	tracer: undefined,
	enabled: true,
};

const otlpTracePlugin = (opts = {}) => {
	const { tracer, enabled } = { ...defaults, ...opts };
	if (!enabled) {
		return {};
	}

	let cold = true;
	const store = {};

	const start = (id) => {
		store[id] = tracer.startSpan(id, { parent: store["request"] });
	};
	const stop = (id) => {
		if (!enabled) return;
		if (id === "request") {
			const attributes =
				Object.fromEntries(context.active()._currentContext)?.attributes ?? [];
			for (let i = attributes.length; i--; ) {
				const attribute = attributes[i];
				store[id].setAttribute(attribute.key, attribute.value);
			}
		}
		store[id].end();
	};

	// Only run during cold start
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
export default otlpTracePlugin;
