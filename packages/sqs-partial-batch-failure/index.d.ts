// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface Options {
	logger?: (reason: any, record: any) => void;
}

declare function sqsPartialBatchFailure(options?: Options): middy.MiddlewareObj;

export default sqsPartialBatchFailure;
