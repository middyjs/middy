// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { OmitPath } from "@middy/util";

// Read off a method signature so the parameter is bivariant: a logger
// annotated with a concrete event (`middy.Request<SQSEvent>`) is accepted.
type Logger = {
	bivarianceHack(
		request: middy.Request,
		failure: { reason: unknown; record: unknown },
	): void;
}["bivarianceHack"];

export interface Options {
	/**
	 * Called once per failed record with the request, `omitPaths` applied, and
	 * that record's `reason` and `record`. `record` is `undefined` when
	 * `omitPaths` removes or masks `event` or `event.Records`. May be async:
	 * the returned promises are awaited before the batch result is handed
	 * back. A logger that throws or rejects is reported with `console.error`
	 * and never changes which records are reported as failed.
	 */
	logger?: Logger | false;
	/**
	 * Paths, relative to the `request`, to strip from the copy handed to
	 * `logger`. A path is a dot-delimited string, with `[]` for every element
	 * of an array, e.g.
	 * `event.Records.[].body`, `response.[].reason.cause.data`.
	 * When a key itself holds a dot, give the path as an array of segments:
	 * `["event", "Records", "[]", "messageAttributes", "user.email"]`.
	 * A path that could never match throws when the middleware is created.
	 */
	omitPaths?: ReadonlyArray<OmitPath>;
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
