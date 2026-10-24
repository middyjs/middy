// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export type DsqlClient<TClient = unknown, TConfig = unknown> = (
	config: TConfig,
) => TClient | Promise<TClient>;

export interface DsqlBaseConfig {
	host: string;
	/** Database user for the `pg` adapters (`username` is mapped to it). */
	user?: string;
	/** Database user for the `postgres.js` adapter; mapped to `user` by the `pg` adapters. */
	username?: string;
	database?: string;
	port?: number;
	password?: string;
	ssl?: boolean | object;
	[key: string]: unknown;
}

export interface DsqlOptions<
	TClient = unknown,
	TConfig extends DsqlBaseConfig = DsqlBaseConfig,
> {
	client: DsqlClient<TClient, TConfig>;
	config: TConfig;
	contextKey?: string;
	internalKey?: string;
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
	cacheMaxSize?: number;
}

/**
 * The Lambda context with the connected client under
 * `context.middyContext[contextKey]` (`"dsql"` by default). The Lambda context
 * is read off `middy.Request` rather than imported from `aws-lambda`, which
 * this package does not declare as a peer.
 */
export type Context<
	TClient = unknown,
	TKey extends string = "dsql",
> = middy.Request["context"] & { middyContext: { [Key in TKey]: TClient } };

declare function dsqlMiddleware<
	TClient,
	TConfig extends DsqlBaseConfig = DsqlBaseConfig,
	TKey extends string = "dsql",
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`; `TClient` comes from the
	// adapter passed as `client`.
	options: DsqlOptions<TClient, TConfig> & { contextKey?: TKey },
): middy.MiddlewareObj<unknown, unknown, Error, Context<TClient, TKey>>;

export declare function dsqlValidateOptions<
	TOptions extends DsqlOptions<any, any>,
>(options?: TOptions): TOptions;

export default dsqlMiddleware;
