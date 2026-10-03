// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

// Read off a method signature so the parameter is bivariant: a logger
// annotated with a concrete event (`middy.Request<APIGatewayProxyEvent>`) is
// accepted.
type Logger = {
	bivarianceHack(request: middy.Request): void;
}["bivarianceHack"];

export interface Options {
	logger?: Logger | false;
	fallbackMessage?: string;
	/**
	 * Dot-delimited paths, relative to the `request`, to strip from the copy
	 * handed to `logger`. Use `[]` to descend into arrays, e.g.
	 * `error.cause.data.body`, `event.headers.authorization`.
	 */
	omitPaths?: string[];
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
