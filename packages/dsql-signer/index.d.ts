// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { DsqlSigner, DsqlSignerConfig } from "@aws-sdk/dsql-signer";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function dsqlSignerParam<T>(name: string): ParamType<T>;

export type DsqlSignerFetchConfig = DsqlSignerConfig & { username?: string };

// The signer is constructed directly rather than through `createClient`, so
// assume-role, X-Ray capture and the shared cache size are not honoured.
export type DsqlSignerOptions<AwsSigner = DsqlSigner> = Omit<
	MiddyOptions<AwsSigner, DsqlSignerFetchConfig>,
	"fetchData" | "awsClientAssumeRole" | "awsClientCapture" | "cacheMaxSize"
> & {
	fetchData?: {
		[key: string]: DsqlSignerFetchConfig;
	};
};

export type Context<TOptions extends DsqlSignerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? ContextNamespace<
					TOptions,
					"dsql-signer",
					{ [Key in keyof TFetchData]: string }
				>
			: never
		: LambdaContext;

export type Internal<TOptions extends DsqlSignerOptions | undefined> =
	TOptions extends DsqlSignerOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: string;
				}
			: {}
		: {};

declare function dsqlSigner<
	TOptions extends DsqlSignerOptions | undefined,
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

export declare function dsqlSignerValidateOptions(
	options?: Record<string, unknown>,
): void;

export default dsqlSigner;
