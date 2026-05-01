// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { RecordParser } from "./index.js";

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

export default parseProtobuf;
