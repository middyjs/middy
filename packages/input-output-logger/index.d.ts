// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?: (message: unknown) => void;
	executionContext?: boolean;
	lambdaContext?: boolean;
	omitPaths?: string[];
	mask?: string;
}

declare function inputOutputLogger(options?: Options): middy.MiddlewareObj;

export default inputOutputLogger;
