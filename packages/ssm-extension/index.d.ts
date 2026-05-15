// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamPath<T> = string & { __returnType?: T };

export declare function ssmExtensionParam<T>(path: string): ParamPath<T>;

export interface SsmExtensionOptions {
	fetchData?: { [key: string]: string | ParamPath<unknown> };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
	setToContext?: boolean;
}

export type Context<TOptions extends SsmExtensionOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: TFetchData[Key] extends ParamPath<infer T>
						? T
						: unknown;
				}
			: never
		: LambdaContext;

export type Internal<TOptions extends SsmExtensionOptions | undefined> =
	TOptions extends SsmExtensionOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends ParamPath<infer T>
						? T
						: unknown;
				}
			: {}
		: {};

declare function ssmExtension<TOptions extends SsmExtensionOptions>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function ssmExtensionValidateOptions(
	options?: Record<string, unknown>,
): void;

export default ssmExtension;
