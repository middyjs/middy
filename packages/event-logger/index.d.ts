// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { OmitPath } from "@middy/util";

export interface Options {
	// Method syntax keeps the parameter bivariant, so a logger annotated with a
	// concrete event (`middy.Request<APIGatewayProxyEvent>`) is accepted.
	/**
	 * Receives the request with `omitPaths` applied. May be async: a returned
	 * promise is awaited before the handler runs. A logger that throws or
	 * rejects is reported with `console.error` and never changes the outcome
	 * of the invocation.
	 */
	logger?(request: middy.Request): void;
	/**
	 * Paths, relative to the `request`, to strip from the copy handed to
	 * `logger`. A path is a dot-delimited string, with `[]` for every element
	 * of an array, e.g.
	 * `event.headers.authorization`, `event.Records.[].body`.
	 * When a key itself holds a dot, give the path as an array of segments:
	 * `["event", "CodePipeline.job", "data", "artifactCredentials"]`.
	 * A path that could never match throws when the middleware is created.
	 */
	omitPaths?: ReadonlyArray<OmitPath>;
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
