// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export type RdsClient<TClient = unknown, TConfig = unknown> = (
	config: TConfig,
) => TClient | Promise<TClient>;

export interface RdsBaseConfig {
	host: string;
	username?: string;
	database?: string;
	port?: number;
	password?: string | (() => string | Promise<string>);
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
}

declare function rdsMiddleware(
	options: RdsOptions,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function rdsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default rdsMiddleware;
