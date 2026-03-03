// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	runOnBefore?: boolean;
	runOnAfter?: boolean;
	runOnError?: boolean;
}

declare function doNotWaitForEmptyEventLoop(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export default doNotWaitForEmptyEventLoop;
