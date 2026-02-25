// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { BrotliOptions, ZlibOptions, ZstdOptions } from "node:zlib";

export type ContentEncoding = "br" | "deflate" | "gzip" | "zstd";

export interface Options {
	br?: BrotliOptions;
	gzip?: ZlibOptions;
	deflate?: ZlibOptions;
	zstd?: ZstdOptions;
	overridePreferredEncoding?: string[];
}

export declare function getContentEncodingStream(
	preferredEncoding: ContentEncoding,
): ReturnType<typeof import("node:zlib")["createGzip"]>;

declare function httpContentEncoding(options?: Options): middy.MiddlewareObj;

export default httpContentEncoding;
