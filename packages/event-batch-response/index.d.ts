// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

// Read off a method signature so the parameter is bivariant: a logger
// annotated with a concrete event (`middy.Request<SQSEvent>`) is accepted.
type Logger = {
	bivarianceHack(
		request: middy.Request,
		failure: { reason: unknown; record: unknown },
	): void | Promise<void>;
}["bivarianceHack"];

export interface Options {
	/**
	 * Called once per record that did not fulfil, as
	 * `logger(request, { reason, record })`. The default writes `reason` with
	 * `console.error`. A returned promise is awaited, and a logger that throws
	 * or rejects never changes the response. Set to `false` to turn logging off.
	 */
	logger?: Logger | false;
}

declare function eventBatchResponse(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function eventBatchResponseValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

/**
 * Walk a Lambda batch event into a flat array of records, using the same
 * detection precedence as the middleware. Shared with `@middy/event-batch-handler`
 * so both packages iterate records in the same order.
 *
 * Supported sources: SQS, Kinesis Data Streams, DynamoDB Streams, MSK,
 * self-managed Kafka, S3 Batch Operations, Kinesis Firehose transform.
 *
 * Returns `[]` for an event without a batch shape or with a missing
 * container. Throws for an event that names a source without a batch
 * response contract (Amazon MQ, SNS and others).
 */
export declare function flattenBatchRecords(event: unknown): unknown[];

export default eventBatchResponse;
