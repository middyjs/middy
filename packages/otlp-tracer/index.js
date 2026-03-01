// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	captureHandler: true,
};

const openTelemetryProtocolTracerMiddleware = (opts = {}) => {
	const { captureHandler } = {
		...defaults,
		...opts,
	};

	const openTelemetryProtocolTracerMiddlewareBefore = async (request) => {
		if (captureHandler) {
			request.context.tracerSpan = request.context.tracer?.startSpan("handler");
		}
	};

	const openTelemetryProtocolTracerMiddlewareAfter = async (request) => {
		if (captureHandler) {
			request.context.tracerSpan?.end();
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
