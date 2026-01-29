// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface Options {
	logger?: ((error: any) => void) | boolean;
	fallbackMessage?: string;
}

declare function httpErrorHandler(options?: Options): middy.MiddlewareObj;

export default httpErrorHandler;
