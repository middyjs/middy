// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?: ((error: Error) => void) | boolean;
	fallbackMessage?: string;
}

declare function httpErrorHandler(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export default httpErrorHandler;
