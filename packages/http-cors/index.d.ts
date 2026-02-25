// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	getOrigin?: (
		incomingOrigin: string,
		options: Options,
	) => string | null | undefined;
	credentials?: boolean | string;
	disableBeforePreflightResponse?: boolean;
	headers?: string;
	methods?: string;
	origin?: string;
	origins?: string[];
	exposeHeaders?: string;
	maxAge?: number | string;
	requestHeaders?: string[];
	requestMethods?: string[];
	cacheControl?: string;
	vary?: string;
}

declare function httpCors(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export default httpCors;
