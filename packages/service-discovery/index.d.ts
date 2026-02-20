// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	DiscoverInstancesCommandInput,
	HttpInstanceSummary,
	ServiceDiscoveryClient,
	ServiceDiscoveryClientConfig,
} from "@aws-sdk/client-servicediscovery";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

interface ServiceDiscoveryOptions<
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
		| "setToContext"
	> {
	fetchData?: { [key: string]: DiscoverInstancesCommandInput };
}

export type Context<TOptions extends ServiceDiscoveryOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: HttpInstanceSummary[];
				}
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
>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export default serviceDiscovery;
