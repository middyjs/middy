// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	canonical?: boolean;
	defaultHeaders?: Record<string, string | string[]>;
	normalizeHeaderKey?: (key: string, canonical: boolean) => string;
}

export type Event = {};

declare function httpHeaderNormalizer(
	options?: Options,
): middy.MiddlewareObj<Event>;

export default httpHeaderNormalizer;
