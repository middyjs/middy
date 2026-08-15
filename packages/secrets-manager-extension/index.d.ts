// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";

export type SecretId<T> = string & { __returnType?: T };

export declare function secretsManagerExtensionParam<T>(
	secretId: string,
): SecretId<T>;

export interface SecretsManagerExtensionOptions {
	fetchData?: { [key: string]: string | SecretId<unknown> };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheKeyExpiry?: { [key: string]: number };
	cacheExpiry?: number;
	setToContext?: boolean;
}

export type Context<
	TOptions extends SecretsManagerExtensionOptions | undefined,
> = TOptions extends { setToContext: true }
	? TOptions extends { fetchData: infer TFetchData }
		? LambdaContext & {
				[Key in keyof TFetchData]: TFetchData[Key] extends SecretId<infer T>
					? T
					: unknown;
			}
		: never
	: LambdaContext;

export type Internal<
	TOptions extends SecretsManagerExtensionOptions | undefined,
> = TOptions extends SecretsManagerExtensionOptions
	? TOptions extends { fetchData: infer TFetchData }
		? {
				[Key in keyof TFetchData]: TFetchData[Key] extends SecretId<infer T>
					? T
					: unknown;
			}
		: {}
	: {};

declare function secretsManagerExtension<
	TOptions extends SecretsManagerExtensionOptions,
>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function secretsManagerExtensionValidateOptions(
	options?: Record<string, unknown>,
): void;

export default secretsManagerExtension;
