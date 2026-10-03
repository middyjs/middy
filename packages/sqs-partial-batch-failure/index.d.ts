// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

// Read off a method signature so the parameter is bivariant: a logger
// annotated with a concrete event (`middy.Request<SQSEvent>`) is accepted.
type Logger = {
	bivarianceHack(
		request: middy.Request,
		failure: { reason: unknown; record: unknown },
	): void;
}["bivarianceHack"];

export interface Options {
	logger?: Logger | false;
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

export declare function sqsPartialBatchFailureValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default sqsPartialBatchFailure;
