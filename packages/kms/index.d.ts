// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { KMSClient, KMSClientConfig } from "@aws-sdk/client-kms";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export interface KMSOptions<AwsKMSClient = KMSClient>
	extends Omit<MiddyOptions<AwsKMSClient, KMSClientConfig>, "fetchData"> {
	fetchData?: { [key: string]: string };
}

export interface KMSPublicKey {
	publicKey: Uint8Array;
	keySpec: string;
}

export type Context<TOptions extends KMSOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: KMSPublicKey;
				}
			: never
		: LambdaContext;

export type Internal<TOptions extends KMSOptions | undefined> =
	TOptions extends KMSOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: KMSPublicKey;
				}
			: {}
		: {};

declare function kms<TOptions extends KMSOptions>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function kmsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default kms;
