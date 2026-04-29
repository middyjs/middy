// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { RecordParser } from "./index.js";

export interface ParseAvroOptions {
	schema?: unknown;
	internalKey?: string;
}

export declare function parseAvro(options?: ParseAvroOptions): RecordParser;

export default parseAvro;
