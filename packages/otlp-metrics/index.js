// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	namespace: "default",
	captureColdStartMetric: false,
	captureOnErrorMetric: false,
};

const openTelemetryProtocolMetricsMiddleware = (opts = {}) => {
	const { namespace, captureColdStartMetric, captureOnErrorMetric } = {
		...defaults,
		...opts,
	};

	let coldStart = true;
	const openTelemetryProtocolMetricsMiddlewareBefore = async (request) => {
		request.context.metricsMeter = request.context?.metrics.getMeter(namespace);
		if (coldStart) {
			coldStart = false;
			request.context.metricsMeter?.createCounter("ColdStart").add(1);
		}
	};

	const openTelemetryProtocolMetricsMiddlewareOnError = async (_request) => {
		if (captureOnErrorMetric) {
			request.context.metricsMeter?.createCounter("Error").add(1);
		}
	};

	return {
		before: openTelemetryProtocolMetricsMiddlewareBefore,
		onError: openTelemetryProtocolMetricsMiddlewareOnError,
	};
};

export default openTelemetryProtocolMetricsMiddleware;
