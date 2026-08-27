// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import type {
	BrotliCompress,
	BrotliOptions,
	Deflate,
	Gzip,
	ZlibOptions,
	ZstdCompress,
	ZstdOptions,
} from "node:zlib";
import type middy from "@middy/core";

export type ContentEncoding = "br" | "deflate" | "gzip" | "zstd";

export interface Options {
	br?: boolean | BrotliOptions;
	gzip?: boolean | ZlibOptions;
	deflate?: boolean | ZlibOptions;
	zstd?: boolean | ZstdOptions;
	overridePreferredEncoding?: ContentEncoding[];
	/**
	 * Where `@middy/http-content-negotiation` published its results. Must match
	 * that middleware's `contextKey` when it has been overridden.
	 * @default "http-content-negotiation"
	 */
	contextKeyHttpContentNegotiation?: string;
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
