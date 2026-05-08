// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { DsqlSigner, DsqlSignerConfig } from "@aws-sdk/dsql-signer";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function dsqlSignerParam<T>(name: string): ParamType<T>;

export type DsqlSignerFetchConfig = DsqlSignerConfig & { username?: string };

export type DsqlSignerOptions<AwsSigner = DsqlSigner> = Omit<
	MiddyOptions<AwsSigner, DsqlSignerFetchConfig>,
	"fetchData"
> & {
	fetchData?: {
		[key: string]: DsqlSignerFetchConfig;
	};
};

export type Context<TOptions extends DsqlSignerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: string;
				}
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

declare function dsqlSigner<TOptions extends DsqlSignerOptions | undefined>(
	options?: TOptions,
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
