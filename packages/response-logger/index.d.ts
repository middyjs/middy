// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	// Method syntax keeps the parameter bivariant, so a logger annotated with a
	// concrete event (`middy.Request<APIGatewayProxyEvent>`) is accepted.
	logger?(request: middy.Request): void;
	/**
	 * Dot-delimited paths, relative to the `request`, to strip from the copy
	 * handed to `logger`. Use `[]` to descend into arrays, e.g.
	 * `response.body`, `response.headers.set-cookie`.
	 */
	omitPaths?: string[];
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
	/**
	 * Most bytes of a streamed response body to buffer for the log (default
	 * 209715200, the 200 MiB Lambda streamed response maximum). Past it the logged body is cut and ends with
	 * `...[truncated, logged <max> of <total> bytes]`; the stream sent to the
	 * client is unaffected. Non-stream responses are logged whole.
	 */
	maxBodyBytes?: number;
}

declare function responseLogger(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function responseLoggerValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default responseLogger;
