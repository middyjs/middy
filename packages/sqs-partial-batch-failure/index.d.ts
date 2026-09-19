// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?:
		| ((
				request: middy.Request,
				failure: { reason: unknown; record: unknown },
		  ) => void)
		| false;
	/**
	 * Dot-delimited paths, relative to the `request`, to strip from the copy
	 * handed to `logger`. Use `[]` to descend into arrays, e.g.
	 * `event.Records.[].body`, `response.[].reason.cause.data`.
	 */
	omitPaths?: string[];
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
}

declare function sqsPartialBatchFailure(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function sqsPartialBatchFailureValidateOptions(
	options?: Record<string, unknown>,
): void;

export default sqsPartialBatchFailure;
