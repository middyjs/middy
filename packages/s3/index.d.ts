// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	GetObjectCommandInput,
	S3Client,
	S3ClientConfig,
} from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

// GetObject accepts `ChecksumMode: "ENABLED"`, which the option schema also
// allows, so the SDK input type is used as-is.
export type ParamType<T> = GetObjectCommandInput & {
	__returnType?: T;
};
export declare function s3Param<T>(name: GetObjectCommandInput): ParamType<T>;

export type S3Options<AwsS3Client = S3Client> = Omit<
	MiddyOptions<AwsS3Client, S3ClientConfig>,
	"fetchData"
> & {
	fetchData?: {
		[key: string]: GetObjectCommandInput | ParamType<unknown>;
	};
};

export type Context<TOptions extends S3Options | undefined> = TOptions extends {
	setToContext: true;
}
	? TOptions extends { fetchData: infer TFetchData }
		? ContextNamespace<
				TOptions,
				"s3",
				{
					[Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
						? T
						: unknown;
				}
			>
		: never
	: LambdaContext;

export type Internal<TOptions extends S3Options | undefined> =
	TOptions extends S3Options
		? TOptions extends { fetchData: infer TFetchData }
			? {
					[Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
						? T
						: unknown;
				}
			: {}
		: {};

declare function s3Middleware<
	TOptions extends S3Options | undefined,
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

export declare function s3ValidateOptions(
	options?: Record<string, unknown>,
): void;

export default s3Middleware;
