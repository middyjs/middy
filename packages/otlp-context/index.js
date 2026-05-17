// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { context as otplContext } from "@opentelemetry/api";

const defaults = {
	logger: undefined,
	tracer: undefined,
	metrics: undefined,
};

const openTelemetryProtocolContextMiddleware = (opts = {}) => {
	const { logger, tracer, metrics } = {
		...defaults,
		...opts,
	};
	const openTelemetryProtocolContextMiddlewareBefore = async (request) => {
		const attributes = [];
		for (const key of awsContextKeys) {
			if (request.context[key]) {
				const value = request.context[key];
				//ctx._currentContext.set(key, value)
				attributes.push({ key, value });
			}
		}
		// ctx.setValue(key, value) doesn't work ... :(
		otplContext.active()._currentContext.set("attributes", attributes);
		// Add to lambda context for use within handler
		Object.assign(request.context, {
			logger,
			tracer,
			metrics,
		});
	};

	const openTelemetryProtocolContextMiddlewareAfter = async (request) => {
		await Promise.all([
			request.context.logger?.forceFlush(),
			request.context.tracer?.forceFlush(),
			request.context.metrics?.forceFlush(),
		]);
	};
	const openTelemetryProtocolContextMiddlewareOnError = async (request) => {
		await openTelemetryProtocolContextMiddlewareAfter(request);
	};

	return {
		before: openTelemetryProtocolContextMiddlewareBefore,
		after: openTelemetryProtocolContextMiddlewareAfter,
		onError: openTelemetryProtocolContextMiddlewareOnError,
	};
};

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
const awsContextKeys = [
	"functionName",
	"functionVersion",
	"invokedFunctionArn",
	"memoryLimitInMB",
	"awsRequestId",
	"logGroupName",
	"logStreamName",
	"identity",
	"clientContext",
	"callbackWaitsForEmptyEventLoop",
];

export default openTelemetryProtocolContextMiddleware;
