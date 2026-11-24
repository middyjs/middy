// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

/**
 * Builds the client from the connection config. With `internalKey` set, the
 * config it receives carries `password` as a function (see `DsqlPassword`),
 * never as a string, so a custom adapter has to hand it to a driver that
 * accepts one or call it for every connection it opens.
 */
export type DsqlClient<TClient = unknown, TConfig = unknown> = (
	config: TConfig,
) => TClient | Promise<TClient>;

/**
 * A database password: a string, or a function the driver calls for every
 * connection it opens (`pg` and `postgres.js` both accept one).
 */
export type DsqlPassword = string | (() => string | Promise<string>);

export interface DsqlBaseConfig {
	host: string;
	/** Database user for the `pg` adapters (`username` is mapped to it). */
	user?: string;
	/** Database user for the `postgres.js` adapter; mapped to `user` by the `pg` adapters. */
	username?: string;
	database?: string;
	port?: number;
	/**
	 * Replaced when `internalKey` is set: the client then receives a function
	 * returning the token of the latest invocation.
	 */
	password?: DsqlPassword;
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
	/**
	 * Key in `request.internal` holding the IAM auth token. The token is read
	 * on every invocation and handed to the client as a `password` function.
	 */
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
