// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ContextNamespace } from "@middy/util";
import type { MetricsLogger } from "aws-embedded-metrics";

export { MetricsLogger } from "aws-embedded-metrics";

export interface Options {
	namespace?: string;
	dimensions?: Record<string, string> | Array<Record<string, string>>;
	onFlushError?: (error: Error) => void;
	contextKey?: string;
}

/**
 * The Lambda context with the `MetricsLogger` published under
 * `context.middyContext[contextKey]` (`"cloudwatch-metrics"` by default).
 */
export type Context<TOptions extends Options | undefined> = ContextNamespace<
	TOptions,
	"cloudwatch-metrics",
	MetricsLogger
>;

declare function cloudwatchMetrics<
	TOptions extends Options | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`.
	options?: TOptions & { contextKey?: TKey },
): middy.MiddlewareObj<unknown, unknown, Error, Context<TOptions>>;

export declare function cloudwatchMetricsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default cloudwatchMetrics;
