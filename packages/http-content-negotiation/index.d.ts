// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface Options {
	parseCharsets?: boolean;
	availableCharsets?: string[];
	defaultToFirstCharset?: boolean;
	parseEncodings?: boolean;
	availableEncodings?: string[];
	defaultToFirstEncoding?: boolean;
	parseLanguages?: boolean;
	availableLanguages?: string[];
	defaultToFirstLanguage?: boolean;
	parseMediaTypes?: boolean;
	availableMediaTypes?: string[];
	defaultToFirstMediaType?: boolean;
	failOnMismatch?: boolean;
}

export type Event = {};

export interface Context {
	preferredCharsets: string[];
	preferredCharset: string;
	preferredEncodings: string[];
	preferredEncoding: string;
	preferredLanguages: string[];
	preferredLanguage: string;
	preferredMediaTypes: string[];
	preferredMediaType: string;
}

declare function httpContentNegotiation(
	options?: Options,
): middy.MiddlewareObj<Event>;

export default httpContentNegotiation;
