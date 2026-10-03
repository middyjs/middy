// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ContextNamespace } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamPath<T> = string & { __returnType?: T };

export declare function ssmExtensionParam<T>(path: string): ParamPath<T>;

export interface SsmExtensionOptions {
	fetchData?: { [key: string]: string | ParamPath<unknown> };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
	cacheMaxSize?: number;
	setToContext?: boolean;
	contextKey?: string;
	/** Returns the session token sent to the extension; defaults to `AWS_SESSION_TOKEN`. */
	awsSessionToken?: () => string | undefined | Promise<string | undefined>;
}

export type Context<TOptions extends SsmExtensionOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"ssm-extension",
					{
						[Key in keyof TFetchData]: TFetchData[Key] extends ParamPath<
							infer T
						>
							? T
							: unknown;
					}
				>
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

declare function ssmExtension<
	TOptions extends SsmExtensionOptions,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `SsmExtensionOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof SsmExtensionOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function ssmExtensionValidateOptions<
	TOptions extends SsmExtensionOptions,
>(options?: TOptions): TOptions;

export default ssmExtension;
