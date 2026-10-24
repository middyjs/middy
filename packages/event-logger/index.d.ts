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
	 * `event.headers.authorization`, `event.Records.[].body`.
	 */
	omitPaths?: string[];
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
}

declare function eventLogger(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function eventLoggerValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default eventLogger;
