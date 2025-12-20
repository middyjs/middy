import { hrtime, stderr, stdout } from "node:process";
import { context } from "@opentelemetry/api";

const defaults = {
	logger: console,
	logEvent: false,
	logResponse: false,
	logError: false,
};

const openTelemetryProtocolLoggerMiddleware = (opts = {}) => {
	const { logger, logEvent, logResponse, logError } = {
		...defaults,
		...opts,
	};

	const openTelemetryProtocolLoggerMiddlewareBefore = async (request) => {
		if (logEvent) {
			logger.info(request.event);
		}
	};

	const openTelemetryProtocolLoggerMiddlewareAfter = async (request) => {
		if (logResponse) {
			logger.info(request.response);
		}
	};

	const openTelemetryProtocolLoggerMiddlewareOnError = async (request) => {
		if (request.response === undefined) {
			if (logError) {
				logger.error(request.error);
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
