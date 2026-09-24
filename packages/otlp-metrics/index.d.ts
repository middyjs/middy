// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Metrics } from "@opentelemetry/api";

interface Options {
	metrics: Metrics;
	namespace?: string;
	captureColdStartMetric?: boolean;
	captureOnErrorMetric?: boolean;
}

declare function openTelemetryProtocolMetricsMiddleware(
	options?: Options,
): middy.MiddlewareObj;

export default openTelemetryProtocolMetricsMiddleware;
