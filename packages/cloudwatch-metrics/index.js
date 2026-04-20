// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { validateOptions } from "@middy/util";
import awsEmbeddedMetrics from "aws-embedded-metrics";

const defaults = {
	onFlushError: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		namespace: { type: "string" },
		dimensions: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: { type: "string" },
			},
		},
		onFlushError: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const cloudwatchMetricsValidateOptions = (options) =>
	validateOptions("@middy/cloudwatch-metrics", optionSchema, options);

const cloudwatchMetricsMiddleware = (opts = {}) => {
	const { namespace, dimensions, onFlushError } = { ...defaults, ...opts };
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
		} catch (err) {
			// Flush errors are swallowed to prevent metrics from crashing the
			// handler. Users who need visibility (e.g., to catch IAM or network
			// misconfigurations) can pass `onFlushError` to observe them.
			onFlushError?.(err);
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
