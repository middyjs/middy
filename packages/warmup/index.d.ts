// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

interface Options {
	isWarmingUp?: (event: any) => boolean;
	onWarmup?: (event: any) => void;
}

declare function warmup(options?: Options): middy.MiddlewareObj;

export default warmup;
