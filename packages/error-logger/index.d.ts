// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?: (request: any) => void;
}

declare function errorLogger(options?: Options): middy.MiddlewareObj;

export default errorLogger;
