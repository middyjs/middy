// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
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
	setToContext?: boolean;
}

export type Context<TOptions extends AppConfigExtensionOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: TFetchData[Key] extends AppConfigExtensionFetchParam<
						infer T
					>
						? T
						: unknown;
				}
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

declare function appConfigExtension<TOptions extends AppConfigExtensionOptions>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function appConfigExtensionValidateOptions(
	options?: Record<string, unknown>,
): void;

export default appConfigExtension;
