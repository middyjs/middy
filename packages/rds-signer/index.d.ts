// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Signer, SignerConfig } from "@aws-sdk/rds-signer";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function rdsSignerParam<T>(name: string): ParamType<T>;

// The signer is constructed directly rather than through `createClient`, so
// assume-role, X-Ray capture and the shared cache size are not honoured.
export type RdsSignerOptions<AwsSigner = Signer> = Omit<
	MiddyOptions<AwsSigner, SignerConfig>,
	"fetchData" | "awsClientAssumeRole" | "awsClientCapture" | "cacheMaxSize"
> & {
	fetchData?: {
		[key: string]: SignerConfig;
	};
};

export type Context<TOptions extends RdsSignerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"rds-signer",
					{ [Key in keyof TFetchData]: string }
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends RdsSignerOptions | undefined> =
	TOptions extends RdsSignerOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: string;
				}
			: {}
		: {};

declare function rdsSigner<
	TOptions extends RdsSignerOptions | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`.
	options?: TOptions & { contextKey?: TKey },
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function rdsSignerValidateOptions(
	options?: Record<string, unknown>,
): void;

export default rdsSigner;
