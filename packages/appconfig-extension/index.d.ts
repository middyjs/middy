// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ContextNamespace } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export interface AppConfigExtensionFetchParam<T = unknown> {
	application: string;
	environment: string;
	configuration: string;
	flag?: string | string[];
	__returnType?: T;
}

export declare function appConfigExtensionParam<T>(
	config: Omit<AppConfigExtensionFetchParam<T>, "__returnType">,
): AppConfigExtensionFetchParam<T>;

export interface AppConfigExtensionOptions {
	fetchData?: { [key: string]: AppConfigExtensionFetchParam<unknown> };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
	cacheMaxSize?: number;
	setToContext?: boolean;
	contextKey?: string;
}

export type Context<TOptions extends AppConfigExtensionOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"appconfig-extension",
					{
						[Key in keyof TFetchData]: TFetchData[Key] extends AppConfigExtensionFetchParam<
							infer T
						>
							? T
							: unknown;
					}
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends AppConfigExtensionOptions | undefined> =
	TOptions extends AppConfigExtensionOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends AppConfigExtensionFetchParam<
						infer T
					>
						? T
						: unknown;
				}
			: {}
		: {};

declare function appConfigExtension<
	TOptions extends AppConfigExtensionOptions,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `AppConfigExtensionOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof AppConfigExtensionOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function appConfigExtensionValidateOptions<
	TOptions extends AppConfigExtensionOptions,
>(options?: TOptions): TOptions;

export default appConfigExtension;
