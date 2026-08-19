// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { DiagLogger } from "@opentelemetry/api";
import type { Resource } from "@opentelemetry/resources";
import type { SpanExporter } from "@opentelemetry/sdk-trace-node";
import type { MetricExporter } from "@opentelemetry/sdk-metrics";
import type { TextMapPropagator } from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { StdoutExporter } from "./stdoutExporter.js";

export interface InitResourceOptions {
	detectors?: any[];
}

export interface InitLoggerOptions {
	exporter: DiagLogger;
}

export interface InitMetricsOptions {
	meter: any;
	exporters?: MetricExporter[];
}

export interface InitTracerOptions {
	exporters?: SpanExporter[];
	instrumentations?: Instrumentation[];
	propagator?: TextMapPropagator;
}

export declare function initResource(
	opts: InitResourceOptions,
): Promise<Resource>;
export declare function initLogger(opts: InitLoggerOptions): DiagLogger;
export declare function initMetrics(opts: InitMetricsOptions): any;
export declare function initTracer(opts: InitTracerOptions): any;

export { StdoutExporter };
