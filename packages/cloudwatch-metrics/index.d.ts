// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { MetricsLogger } from "aws-embedded-metrics";
import type { Context as LambdaContext } from "aws-lambda";
export { MetricsLogger } from "aws-embedded-metrics";

export interface Options {
	namespace?: string;
	dimensions?: Array<Record<string, string>>;
}

export type Context = LambdaContext & {
	metrics: MetricsLogger;
};

declare function cloudwatchMetrics(
	options?: Options,
): middy.MiddlewareObj<unknown, any, Error, Context>;

export default cloudwatchMetrics;
