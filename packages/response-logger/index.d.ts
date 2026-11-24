// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { OmitPath } from "@middy/util";

export interface Options {
	// Method syntax keeps the parameter bivariant, so a logger annotated with a
	// concrete event (`middy.Request<APIGatewayProxyEvent>`) is accepted.
	/**
	 * Receives the request with `omitPaths` applied. May be async: a returned
	 * promise is awaited before the response is handed back, or before a
	 * streamed response ends. A logger that throws or rejects is reported with
	 * `console.error` and never changes the outcome of the invocation.
	 */
	logger?(request: middy.Request): void;
	/**
	 * Paths, relative to the `request`, to strip from the copy handed to
	 * `logger`. A path is a dot-delimited string, with `[]` for every element
	 * of an array, e.g.
	 * `response.body`, `response.headers.set-cookie`.
	 * When a key itself holds a dot, give the path as an array of segments:
	 * `["response", "user.email"]`.
	 * A path that could never match throws when the middleware is created.
	 */
	omitPaths?: ReadonlyArray<OmitPath>;
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
	/**
	 * Most bytes of a streamed response body to buffer for the log (default
	 * 1048576, the 1,024 KB that one CloudWatch Logs event can hold). Past it
	 * the logged body is cut and ends with
	 * `...[truncated, logged <max> of <total> bytes]`; the stream sent to the
	 * client is unaffected. Non-stream responses are logged whole. A streamed
	 * body that `omitPaths` keeps from the log is not buffered at all: any
	 * `response` path when the stream is the response itself, and
	 * `response`, `response.body` or a path below it when the stream is the
	 * body.
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
