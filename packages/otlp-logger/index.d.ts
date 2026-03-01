// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface Options {
	logger?: Console;
	logEvent?: boolean;
	logResponse?: boolean;
	logOnError?: boolean;
}

declare function openTelemetryProtocolLoggerMiddleware(
	options?: Options,
): middy.MiddlewareObj;

export default openTelemetryProtocolLoggerMiddleware;
