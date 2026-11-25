// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Context } from "aws-lambda";

/**
 * Per-record handler.
 *
 * `context` defaults to the standard Lambda `Context`. Under durable
 * functions each record runs in its own child context
 * (`context.runInChildContext("record-N", ...)` from
 * `@aws/durable-execution-sdk-js`) and the record handler receives that child
 * `DurableContext`. Narrow the `TContext` generic to the SDK's
 * `DurableContext` to type-check nested `ctx.step(...)` calls. The durable
 * runtime retries those steps, not the record handler itself.
 */
export type RecordHandler<
	TRecord = unknown,
	TResult = unknown,
	TContext = Context,
> = (record: TRecord, context: TContext) => TResult | Promise<TResult>;

export interface EventBatchHandlerOptions {
	/**
	 * Most records that run at once. Unset, a Kinesis or DynamoDB Streams
	 * batch runs one record at a time in order and stops at the first failure,
	 * and any other batch runs all its records at once, which a Lambda trigger
	 * bounds with BatchSize. Set it under a long-running poller such as
	 * `@middy/ecs-batch`, whose batches have no such bound. Setting it also
	 * opts a Kinesis or DynamoDB Streams batch out of ordered processing: its
	 * records then run as a pool and a failure does not stop the others. An
	 * SQS FIFO batch always runs in order.
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
