// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	AppConfigDataClient,
	AppConfigDataClientConfig,
	StartConfigurationSessionRequest,
} from "@aws-sdk/client-appconfigdata";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = StartConfigurationSessionRequest & {
	__returnType?: T;
};
export declare function appConfigParam<T>(
	name: StartConfigurationSessionRequest,
): ParamType<T>;

export interface AppConfigOptions<AwsAppConfigClient = AppConfigDataClient>
	extends Omit<
		MiddyOptions<AwsAppConfigClient, AppConfigDataClientConfig>,
		"fetchData"
	> {
	fetchData?: {
		[key: string]: StartConfigurationSessionRequest | ParamType<unknown>;
	};
}

export type Context<TOptions extends AppConfigOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"appconfig",
					{
						[Key in keyof TFetchData]: TFetchData[Key] extends ParamType<
							infer T
						>
							? T
							: unknown;
					}
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends AppConfigOptions | undefined> =
	TOptions extends AppConfigOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
						? T
						: unknown;
				}
			: {}
		: {};

declare function appConfigMiddleware<
	TOptions extends AppConfigOptions,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `AppConfigOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof AppConfigOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function appConfigValidateOptions<
	TOptions extends AppConfigOptions,
>(options?: TOptions): TOptions;

export default appConfigMiddleware;
