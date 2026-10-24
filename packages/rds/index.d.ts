// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export type RdsClient<TClient = unknown, TConfig = unknown> = (
	config: TConfig,
) => TClient | Promise<TClient>;

export interface RdsBaseConfig {
	host: string;
	/** Database user for the `pg` adapters (`username` is mapped to it). */
	user?: string;
	/** Database user for the `postgres.js` adapter; mapped to `user` by the `pg` adapters. */
	username?: string;
	database?: string;
	port?: number;
	password?: string;
	[key: string]: unknown;
}

export interface RdsOptions<
	TClient = unknown,
	TConfig extends RdsBaseConfig = RdsBaseConfig,
> {
	client: RdsClient<TClient, TConfig>;
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
 * `context.middyContext[contextKey]` (`"rds"` by default). The Lambda context
 * is read off `middy.Request` rather than imported from `aws-lambda`, which
 * this package does not declare as a peer.
 */
export type Context<
	TClient = unknown,
	TKey extends string = "rds",
> = middy.Request["context"] & { middyContext: { [Key in TKey]: TClient } };

declare function rdsMiddleware<
	TClient,
	TConfig extends RdsBaseConfig = RdsBaseConfig,
	TKey extends string = "rds",
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`; `TClient` comes from the
	// adapter passed as `client`.
	options: RdsOptions<TClient, TConfig> & { contextKey?: TKey },
): middy.MiddlewareObj<unknown, unknown, Error, Context<TClient, TKey>>;

export declare function rdsValidateOptions<
	TOptions extends RdsOptions<any, any>,
>(options?: TOptions): TOptions;

export default rdsMiddleware;
