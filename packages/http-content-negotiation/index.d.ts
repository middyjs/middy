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

// A list is absent when its `parseX` option is off; the single preference is
// also `undefined` when nothing matched and no default or 406 applied.
export interface NegotiationResults {
	preferredCharsets?: string[];
	preferredCharset?: string;
	preferredEncodings?: string[];
	preferredEncoding?: string;
	preferredLanguages?: string[];
	preferredLanguage?: string;
	preferredMediaTypes?: string[];
	preferredMediaType?: string;
}

export type Context<TOptions extends Options | undefined = undefined> =
	ContextNamespace<TOptions, "http-content-negotiation", NegotiationResults>;

declare function httpContentNegotiation<
	TOptions extends Options | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `Options` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof Options>,
			never
		>,
): middy.MiddlewareObj<unknown, unknown, Error, Context<TOptions>>;

export declare function httpContentNegotiationValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default httpContentNegotiation;
