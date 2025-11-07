const defaults = {
	metrics: undefined,
	namespace: "default",
	captureColdStartMetric: false,
	captureOnErrorMetric: false,
};

const openTelemetryProtocolMetricsMiddleware = (opts = {}) => {
	const { metrics, namespace, captureColdStartMetric } = {
		...defaults,
		...opts,
	};
	const meter = metrics.getMeter(namespace);

	let coldStartMetric;
	if (captureColdStartMetric) {
		coldStartMetric = meter.createCounter("ColdStart");
		coldStartMetric.add(1);
	}

	let onErrorMetric;
	if (captureOnErrorMetric) {
		onErrorMetric = meter.createCounter("Error");
	}

	const openTelemetryProtocolMetricsMiddlewareOnError = async (_request) => {
		if (captureOnErrorMetric) {
			onErrorMetric.add(1);
		}
	};

	return {
		onError: openTelemetryProtocolMetricsMiddlewareOnError,
	};
};

export default openTelemetryProtocolMetricsMiddleware;
