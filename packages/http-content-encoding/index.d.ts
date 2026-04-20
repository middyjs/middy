// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	BrotliCompress,
	BrotliOptions,
	Deflate,
	Gzip,
	ZlibOptions,
	ZstdCompress,
	ZstdOptions,
} from "node:zlib";

export type ContentEncoding = "br" | "deflate" | "gzip" | "zstd";

export interface Options {
	br?: boolean | BrotliOptions;
	gzip?: boolean | ZlibOptions;
	deflate?: boolean | ZlibOptions;
	zstd?: boolean | ZstdOptions;
	overridePreferredEncoding?: ContentEncoding[];
}

export declare function getContentEncodingStream(
	preferredEncoding: ContentEncoding,
): BrotliCompress | Deflate | Gzip | ZstdCompress;

declare function httpContentEncoding(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpContentEncodingValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpContentEncoding;
