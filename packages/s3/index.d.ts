// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	GetObjectCommandInput,
	S3Client,
	S3ClientConfig,
} from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export type GetObjectCommandInputNoChecksumMode = Omit<
	GetObjectCommandInput,
	"ChecksumMode"
> & {
	ChecksumMode?: never;
};
export type ParamType<T> = GetObjectCommandInputNoChecksumMode & {
	__returnType?: T;
};
export declare function s3Req<T>(
	req: GetObjectCommandInputNoChecksumMode,
): ParamType<T>;

export type S3Options<AwsS3Client = S3Client> = Omit<
	MiddyOptions<AwsS3Client, S3ClientConfig>,
	"fetchData"
> & {
	fetchData?: {
		[key: string]: GetObjectCommandInputNoChecksumMode | ParamType<unknown>;
	};
};

export type Context<TOptions extends S3Options | undefined> = TOptions extends {
	setToContext: true;
}
	? TOptions extends { fetchData: infer TFetchData }
		? LambdaContext & {
				[Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
					? T
					: unknown;
			}
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

declare function s3Middleware<TOptions extends S3Options | undefined>(
	options?: TOptions,
): middy.MiddlewareObj<
	unknown,
	any,
	Error,
	Context<TOptions>,
	Internal<TOptions>
>;

export default s3Middleware;
