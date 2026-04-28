// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Request } from "@middy/core";

// Buffer extends Uint8Array — typed via Uint8Array to avoid a hard @types/node
// dependency at the type-test boundary.
export type RecordParser = (
	buffer: Uint8Array,
	record: Record<string, unknown>,
	request: Request,
) => unknown | Promise<unknown>;

export interface ParseJsonOptions {
	reviver?: (this: unknown, key: string, value: unknown) => unknown;
}
export declare function parseJson(options?: ParseJsonOptions): RecordParser;

export interface ParseAvroOptions {
	schema?: unknown;
	internalKey?: string;
}
export declare function parseAvro(options?: ParseAvroOptions): RecordParser;

export interface ParseProtobufOptions {
	root?: {
		lookupType: (name: string) => {
			decode: (buf: Uint8Array) => { toJSON: () => unknown };
		};
	};
	messageType?: string;
	internalKey?: string;
}
export declare function parseProtobuf(
	options?: ParseProtobufOptions,
): RecordParser;

export interface EventBatchParserOptions {
	key?: RecordParser;
	value?: RecordParser;
	body?: RecordParser;
	data?: RecordParser;
	glueSchemaRegistry?: Record<string, unknown>;
	disableEventSourceError?: boolean;
}

declare function eventBatchParser(
	options?: EventBatchParserOptions,
): middy.MiddlewareObj;

export declare function eventBatchParserValidateOptions(
	options?: Record<string, unknown>,
): void;

export default eventBatchParser;
