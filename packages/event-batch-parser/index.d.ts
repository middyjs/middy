// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Request } from "@middy/core";

// Buffer extends Uint8Array — typed via Uint8Array to avoid a hard @types/node
// dependency at the type-test boundary.
export interface RecordFraming {
	payload: Uint8Array;
	schemaVersionId?: string;
}
export type RecordParser = (
	// Binary sources (Kafka/Kinesis/Firehose/MQ) deliver decoded bytes; text
	// sources (SQS) deliver the value already decoded as a string.
	payload: Uint8Array | string,
	record: Record<string, unknown>,
	request: Request,
	// Glue framing is only present on binary sources; undefined for text sources.
	framing?: RecordFraming,
) => unknown | Promise<unknown>;

export interface EventBatchParserOptions {
	key?: RecordParser;
	value?: RecordParser;
	body?: RecordParser;
	data?: RecordParser;
	disableEventSourceError?: boolean;
	maxDecompressedBytes?: number;
}

declare function eventBatchParser(
	options?: EventBatchParserOptions,
): middy.MiddlewareObj;

export declare function eventBatchParserValidateOptions(
	options?: Record<string, unknown>,
): void;

export default eventBatchParser;
