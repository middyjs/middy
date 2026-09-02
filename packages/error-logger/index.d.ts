// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?: ((request: middy.Request) => void) | false;
	/**
	 * Dot-delimited paths, relative to the `request`, to strip from the copy
	 * handed to `logger`. Use `[]` to descend into arrays, e.g.
	 * `error.cause.data.body`, `event.headers.authorization`.
	 */
	omitPaths?: string[];
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
}

declare function errorLogger(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function errorLoggerValidateOptions(
	options?: Record<string, unknown>,
): void;

export default errorLogger;
