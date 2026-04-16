// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import awsEmbeddedMetrics from "aws-embedded-metrics";

const defaults = {};

const cloudwatchMetricsMiddleware = (opts = {}) => {
	const { namespace, dimensions } = { ...defaults, ...opts };
	const cloudwatchMetricsBefore = async (request) => {
		const metrics = awsEmbeddedMetrics.createMetricsLogger();

		// If not set, defaults to aws-embedded-metrics
		if (namespace) {
			metrics.setNamespace(namespace);
		}

		// If not set, keeps defaults as defined here https://github.com/awslabs/aws-embedded-metrics-node/#configuration
		if (dimensions) {
			metrics.setDimensions(dimensions);
		}
		Object.assign(request.context, { metrics });
	};

	const flushMetrics = async (request) => {
		try {
			await request.context.metrics?.flush();
		} catch {
			// Swallow flush errors to prevent metrics from crashing the handler
		}
	};
	const cloudwatchMetricsAfter = flushMetrics;
	const cloudwatchMetricsOnError = flushMetrics;

	return {
		before: cloudwatchMetricsBefore,
		after: cloudwatchMetricsAfter,
		onError: cloudwatchMetricsOnError,
	};
};

export default cloudwatchMetricsMiddleware;
