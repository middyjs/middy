// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	br?: any;
	gzip?: any;
	deflate?: any;
	zstd?: any;
	overridePreferredEncoding?: string[];
}

declare function httpContentEncoding(options?: Options): middy.MiddlewareObj;

export default httpContentEncoding;
