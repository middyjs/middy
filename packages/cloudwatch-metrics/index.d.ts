// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { MetricsLogger } from "aws-embedded-metrics";
import type { Context as LambdaContext } from "aws-lambda";

export { MetricsLogger } from "aws-embedded-metrics";

export interface Options {
	namespace?: string;
	dimensions?: Record<string, string> | Array<Record<string, string>>;
	onFlushError?: (error: Error) => void;
}

export type Context = LambdaContext & {
	metrics: MetricsLogger;
};

declare function cloudwatchMetrics(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function cloudwatchMetricsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default cloudwatchMetrics;
