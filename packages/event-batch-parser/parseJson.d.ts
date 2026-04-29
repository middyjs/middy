// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { RecordParser } from "./index.js";

export interface ParseJsonOptions {
	reviver?: (this: unknown, key: string, value: unknown) => unknown;
}

export declare function parseJson(options?: ParseJsonOptions): RecordParser;

export default parseJson;
