// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	DiscoverInstancesCommandInput,
	HttpInstanceSummary,
	ServiceDiscoveryClient,
	ServiceDiscoveryClientConfig,
} from "@aws-sdk/client-servicediscovery";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function serviceDiscoveryParam<T>(name: string): ParamType<T>;

export interface ServiceDiscoveryOptions<
	AwsServiceDiscoveryClient = ServiceDiscoveryClient,
> extends Pick<
		MiddyOptions<AwsServiceDiscoveryClient, ServiceDiscoveryClientConfig>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientAssumeRole"
		| "awsClientCapture"
		| "disablePrefetch"
		| "cacheKey"
		| "cacheExpiry"
		| "cacheKeyExpiry"
		| "cacheMaxSize"
		| "setToContext"
		| "contextKey"
	> {
	fetchData?: { [key: string]: DiscoverInstancesCommandInput };
}

export type Context<TOptions extends ServiceDiscoveryOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"service-discovery",
					{ [Key in keyof TFetchData]: HttpInstanceSummary[] }
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends ServiceDiscoveryOptions | undefined> =
	TOptions extends ServiceDiscoveryOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: HttpInstanceSummary[];
				}
			: {}
		: {};

declare function serviceDiscovery<
	TOptions extends ServiceDiscoveryOptions | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `ServiceDiscoveryOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof ServiceDiscoveryOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function serviceDiscoveryValidateOptions<
	TOptions extends ServiceDiscoveryOptions,
>(options?: TOptions): TOptions;

export default serviceDiscovery;
