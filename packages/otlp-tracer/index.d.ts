// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Tracer } from "@opentelemetry/api";

interface Options {
	tracer?: Tracer;
}

declare function openTelemetryProtocolTracerMiddleware(
	options?: Options,
): middy.MiddlewareObj;

export default openTelemetryProtocolTracerMiddleware;
