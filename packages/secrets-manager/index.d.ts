// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	SecretsManagerClient,
	SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type SecretType<T> = string & { __returnType?: T };
export declare function secretsManagerParam<T>(path: string): SecretType<T>;

export interface SecretsManagerOptions<
	AwsSecretsManagerClient = SecretsManagerClient,
> extends Omit<
		MiddyOptions<AwsSecretsManagerClient, SecretsManagerClientConfig>,
		"fetchData"
	> {
	fetchData?: { [key: string]: string | SecretType<unknown> };
	fetchRotationDate?: boolean | Record<string, boolean>;
}

export type Context<TOptions extends SecretsManagerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"secrets-manager",
					{
						[Key in keyof TFetchData]: TFetchData[Key] extends SecretType<
							infer T
						>
							? T
							: unknown;
					}
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends SecretsManagerOptions | undefined> =
	TOptions extends SecretsManagerOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends SecretType<infer T>
						? T
						: unknown;
				}
			: {}
		: {};

declare function secretsManager<
	TOptions extends SecretsManagerOptions | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `SecretsManagerOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof SecretsManagerOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function secretsManagerValidateOptions<
	TOptions extends SecretsManagerOptions,
>(options?: TOptions): TOptions;

export default secretsManager;
