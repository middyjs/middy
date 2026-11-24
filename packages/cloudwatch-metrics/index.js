// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import {
	reservedPropertyNames,
	setContextNamespace,
	validateOptions,
} from "@middy/util";
import awsEmbeddedMetrics from "aws-embedded-metrics";

const name = "cloudwatch-metrics";
const pkg = `@middy/${name}`;

const defaults = {
	onFlushError: undefined,
	contextKey: name,
};

// `dimensions` accepts either a single dimension set (object of
// string->string) or an array of dimension sets, matching the documented
// API and aws-embedded-metrics' `setDimensions(dimensionSets)` signature.
// Limits from the embedded metric format specification:
// https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
const dimensionSetSchema = {
	type: "object",
	// "A DimensionSet MUST NOT contain more than 30 dimension keys." Each key
	// "MUST contain 1 to 250 printable ASCII characters", "MUST NOT contain
	// only whitespace" and "MUST NOT start with a colon".
	propertyNames: {
		type: "string",
		maxLength: 250,
		pattern: /^(?:[\x21-\x39\x3B-\x7E]| +[\x21-\x7E])[\x20-\x7E]*$/u,
		not: { type: "string", enum: reservedPropertyNames },
	},
	maxProperties: 30,
	required: [],
	// A value "MUST contain 1 to 1024 printable ASCII characters and MUST NOT
	// contain only whitespace."
	additionalProperties: {
		type: "string",
		maxLength: 1024,
		pattern: /^ *[\x21-\x7E][\x20-\x7E]*$/u,
	},
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:cloudwatch-metrics:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		// "The namespace MUST contain 1 to 255 printable ASCII characters (0x20
		// through 0x7E) and MUST NOT contain only whitespace."
		namespace: {
			type: "string",
			maxLength: 255,
			pattern: /^ *[\x21-\x7E][\x20-\x7E]*$/u,
		},
		dimensions: {
			oneOf: [
				dimensionSetSchema,
				{
					type: "array",
					items: dimensionSetSchema,
					maxItems: 1024,
					uniqueItems: true,
					unevaluatedItems: false,
				},
			],
		},
		onFlushError: { $ref: "#/$defs/Function" },
		contextKey: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\x21-\x7E]+$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const cloudwatchMetricsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const cloudwatchMetricsMiddleware = (opts = {}) => {
	const { namespace, dimensions, onFlushError, contextKey } = {
		...defaults,
		...opts,
	};

	if (dimensions) {
		const dimensionSets = Array.isArray(dimensions) ? dimensions : [dimensions];
		for (const set of dimensionSets) {
			if (Object.keys(set).length > 30) {
				throw new Error(
					`${pkg} a dimension set may contain at most 30 dimensions`,
					{ cause: { package: pkg } },
				);
			}
		}
	}
	// The logger each request created, taken on its first flush: a request
	// flushes only its own logger (never one inherited from an outer middy's
	// namespace) and only once, even when onError runs after a flushed after.
	const loggers = new WeakMap();
	const cloudwatchMetricsBefore = (request) => {
		const metrics = awsEmbeddedMetrics.createMetricsLogger();

		// If not set, defaults to aws-embedded-metrics
		if (namespace) {
			metrics.setNamespace(namespace);
		}

		// If not set, keeps defaults as defined here https://github.com/awslabs/aws-embedded-metrics-node/#configuration
		if (dimensions) {
			metrics.setDimensions(dimensions);
		}
		setContextNamespace(request, contextKey, metrics);
		loggers.set(request, metrics);
	};

	const flushMetrics = async (request) => {
		const metrics = loggers.get(request);
		if (metrics === undefined) return;
		loggers.delete(request);
		try {
			await metrics.flush();
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
