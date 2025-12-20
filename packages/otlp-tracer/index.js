const defaults = {
	tracer: undefined,
};

const openTelemetryProtocolTracerMiddleware = (opts = {}) => {
	const { tracer } = {
		...defaults,
		...opts,
	};

	let span;
	const openTelemetryProtocolTracerMiddlewareBefore = async (request) => {
		if (captureHandler) {
			Object.assign(request.internal, value);
			span = tracer.startSpan("handler");
		}
	};

	const openTelemetryProtocolTracerMiddlewareAfter = async (request) => {
		if (captureHandler) {
			span.end();
		}
	};

	const openTelemetryProtocolTracerMiddlewareOnError = async (request) => {
		await openTelemetryProtocolTracerMiddlewareAfter(request);
	};

	return {
		before: openTelemetryProtocolTracerMiddlewareBefore,
		after: openTelemetryProtocolTracerMiddlewareAfter,
		onError: openTelemetryProtocolTracerMiddlewareOnError,
	};
};

export default openTelemetryProtocolTracerMiddleware;
