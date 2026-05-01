// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export type DsqlClient<TClient = unknown, TConfig = unknown> = (
	config: TConfig,
) => TClient | Promise<TClient>;

export interface DsqlBaseConfig {
	host: string;
	username?: string;
	database?: string;
	region?: string;
	port?: number;
	tokenDurationSecs?: number;
	[key: string]: unknown;
}

export interface DsqlOptions<
	TClient = unknown,
	TConfig extends DsqlBaseConfig = DsqlBaseConfig,
> {
	client: DsqlClient<TClient, TConfig>;
	config: TConfig;
	contextKey?: string;
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
}

declare function dsqlMiddleware(
	options: DsqlOptions,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function dsqlValidateOptions(
	options?: Record<string, unknown>,
): void;

export default dsqlMiddleware;
