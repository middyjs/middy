// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	filteringKeyName?: string;
}

declare function httpPartialResponse(options?: Options): middy.MiddlewareObj;

export default httpPartialResponse;
