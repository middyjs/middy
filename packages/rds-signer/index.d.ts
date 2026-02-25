// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Signer, SignerConfig } from "@aws-sdk/rds-signer";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type ParamType<T> = string & { __returnType?: T };
export declare function rdsSignerParam<T>(name: string): ParamType<T>;

export type RdsSignerOptions<AwsSigner = Signer> = Omit<
	MiddyOptions<AwsSigner, SignerConfig>,
	"fetchData"
> & {
	fetchData?: {
		[key: string]: SignerConfig;
	};
};

export type Context<TOptions extends RdsSignerOptions | undefined> =
	TOptions extends { setToContext: true }
		? TOptions extends { fetchData: infer TFetchData }
			? LambdaContext & {
					[Key in keyof TFetchData]: string;
				}
			: LambdaContext
		: LambdaContext;

export type Internal<TOptions extends RdsSignerOptions | undefined> =
	TOptions extends RdsSignerOptions
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: string;
				}
			: {}
		: {};

declare function rdsSigner<TOptions extends RdsSignerOptions | undefined>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	unknown,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export default rdsSigner;
