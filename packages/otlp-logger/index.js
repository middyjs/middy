// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

const defaults = {
	logEvent: false,
	logResponse: false,
	logError: false,
};

const openTelemetryProtocolLoggerMiddleware = (opts = {}) => {
	const { logEvent, logResponse, logError } = {
		...defaults,
		...opts,
	};

	const openTelemetryProtocolLoggerMiddlewareBefore = async (request) => {
		if (logEvent) {
			request.context.logger?.info(request.event);
		}
	};

	const openTelemetryProtocolLoggerMiddlewareAfter = async (request) => {
		if (logResponse) {
			request.context.logger?.info(request.response);
		}
	};

	const openTelemetryProtocolLoggerMiddlewareOnError = async (request) => {
		if (request.response === undefined) {
			if (logError) {
				request.context.logger?.error(request.error);
			}
			return;
		}
		await openTelemetryProtocolLoggerMiddlewareAfter(request);
	};

	return {
		before: openTelemetryProtocolLoggerMiddlewareBefore,
		after: openTelemetryProtocolLoggerMiddlewareAfter,
		onError: openTelemetryProtocolLoggerMiddlewareOnError,
	};
};

export default openTelemetryProtocolLoggerMiddleware;
