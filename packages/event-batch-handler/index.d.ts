// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Context } from "aws-lambda";

/**
 * Per-record handler.
 *
 * `context` defaults to the standard Lambda `Context`. Under Durable
 * Functions, the wrapper passes the per-step child context provided by
 * `@aws/durable-execution-sdk-js`'s `withDurableExecution`, narrow the
 * `TContext` generic to that SDK's `DurableContext` to type-check
 * nested `ctx.step(...)` calls.
 */
export type RecordHandler<
	TRecord = unknown,
	TResult = unknown,
	TContext = Context,
> = (record: TRecord, context: TContext) => TResult | Promise<TResult>;

export interface EventBatchHandlerOptions {
	/**
	 * Most records run at once. Unset runs the whole batch at once, which a
	 * Lambda trigger bounds with BatchSize; set it under a long-running poller
	 * such as `@middy/ecs-batch`, whose batches have no such bound.
	 */
	concurrency?: number;
}

declare function eventBatchHandler<
	TRecord = unknown,
	TResult = unknown,
	TContext = Context,
>(
	recordHandler: RecordHandler<TRecord, TResult, TContext>,
	options?: EventBatchHandlerOptions,
): (
	event: unknown,
	context: TContext,
) => Promise<PromiseSettledResult<TResult>[]>;

export declare function eventBatchHandlerValidateOptions<
	TOptions extends EventBatchHandlerOptions,
>(options?: TOptions): TOptions;

export default eventBatchHandler;
