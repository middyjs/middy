// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { OmitPath } from "@middy/util";

// Read off a method signature so the parameter is bivariant: a logger
// annotated with a concrete event (`middy.Request<APIGatewayProxyEvent>`) is
// accepted.
type Logger = {
	bivarianceHack(request: middy.Request): void;
}["bivarianceHack"];

export interface Options {
	/**
	 * Receives the request with `omitPaths` applied. May be async: a returned
	 * promise is awaited before the response is built. A logger that throws or
	 * rejects is reported with `console.error` and never changes the response.
	 * `false` disables logging.
	 */
	logger?: Logger | false;
	fallbackMessage?: string;
	/**
	 * Paths, relative to the `request`, to strip from the copy handed to
	 * `logger`. A path is a dot-delimited string, with `[]` for every element
	 * of an array, e.g.
	 * `error.cause.data.body`, `event.headers.authorization`.
	 * When a key itself holds a dot, give the path as an array of segments:
	 * `["event", "headers", "x.api.key"]`.
	 * A path that could never match throws when the middleware is created.
	 */
	omitPaths?: ReadonlyArray<OmitPath>;
	/** Replace matched values with this string instead of removing the key. */
	mask?: string;
}

declare function httpErrorHandler(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpErrorHandlerValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default httpErrorHandler;
