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
// assume-role and X-Ray capture are not honoured.
export type DsqlSignerOptions<AwsSigner = DsqlSigner> = Omit<
	MiddyOptions<AwsSigner, DsqlSignerFetchConfig>,
	"fetchData" | "awsClientAssumeRole" | "awsClientCapture"
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
	// key narrows `middyContext` without `as const`. The `never` record rejects
	// keys `DsqlSignerOptions` does not declare, which inference would otherwise accept.
	options?: TOptions & { contextKey?: TKey } & Record<
			Exclude<keyof TOptions, keyof DsqlSignerOptions>,
			never
		>,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export declare function dsqlSignerValidateOptions<
	TOptions extends DsqlSignerOptions,
>(options?: TOptions): TOptions;

export default dsqlSigner;
