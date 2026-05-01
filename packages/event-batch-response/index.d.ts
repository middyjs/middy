// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

declare function eventBatchResponse(): middy.MiddlewareObj<
	unknown,
	unknown,
	Error
>;

/**
 * Walk a Lambda batch event into a flat array of records, using the same
 * detection precedence as the middleware. Shared with `@middy/event-batch-handler`
 * so both packages iterate records in the same order.
 *
 * Supported sources: SQS, Kinesis Data Streams, DynamoDB Streams, MSK,
 * self-managed Kafka, S3 Batch Operations, Kinesis Firehose transform.
 *
 * Returns `[]` for unrecognized event shapes or missing containers.
 * Coerces non-array containers to `[]` rather than throwing — malformed
 * events degrade silently.
 */
export declare function flattenBatchRecords(event: unknown): unknown[];

export default eventBatchResponse;
