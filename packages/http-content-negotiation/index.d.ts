// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ContextNamespace } from "@middy/util";

export interface Options {
	parseCharsets?: boolean;
	availableCharsets?: string[];
	defaultToFirstCharset?: boolean;
	parseEncodings?: boolean;
	availableEncodings?: Array<"br" | "deflate" | "gzip" | "zstd" | "identity">;
	defaultToFirstEncoding?: boolean;
	parseLanguages?: boolean;
	availableLanguages?: string[];
	defaultToFirstLanguage?: boolean;
	parseMediaTypes?: boolean;
	availableMediaTypes?: string[];
	defaultToFirstMediaType?: boolean;
	failOnMismatch?: boolean;
	contextKey?: string;
}

export interface NegotiationResults {
	preferredCharsets: string[];
	preferredCharset: string;
	preferredEncodings: string[];
	preferredEncoding: string;
	preferredLanguages: string[];
	preferredLanguage: string;
	preferredMediaTypes: string[];
	preferredMediaType: string;
}

export type Context<TOptions extends Options | undefined = undefined> =
	ContextNamespace<TOptions, "http-content-negotiation", NegotiationResults>;

declare function httpContentNegotiation(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpContentNegotiationValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpContentNegotiation;
