// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	wrapNumbers?: boolean;
	maxDecompressedBytes?: number;
}

declare function eventNormalizer(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function eventNormalizerValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default eventNormalizer;
