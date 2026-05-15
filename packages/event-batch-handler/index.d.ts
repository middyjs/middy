// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Context } from "aws-lambda";

/**
 * Per-record handler.
 *
 * `context` defaults to the standard Lambda `Context`. Under Durable
 * Functions, the wrapper passes the per-step child context provided by
 * `@aws/durable-execution-sdk-js`'s `withDurableExecution` — narrow the
 * `TContext` generic to that SDK's `DurableContext` to type-check
 * nested `ctx.step(...)` calls.
 */
export type RecordHandler<
	TRecord = unknown,
	TResult = unknown,
	TContext = Context,
> = (record: TRecord, context: TContext) => TResult | Promise<TResult>;

declare function eventBatchHandler<
	TRecord = unknown,
	TResult = unknown,
	TContext = Context,
>(
	recordHandler: RecordHandler<TRecord, TResult, TContext>,
): (
	event: unknown,
	context: TContext,
) => Promise<PromiseSettledResult<TResult>[]>;

export default eventBatchHandler;
