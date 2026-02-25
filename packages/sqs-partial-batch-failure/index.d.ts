// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	logger?: (reason: unknown, record: unknown) => void;
}

declare function sqsPartialBatchFailure(options?: Options): middy.MiddlewareObj;

export default sqsPartialBatchFailure;
