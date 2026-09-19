// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import type { ContextNamespace, Options as MiddyOptions } from "@middy/util";

export type ParamType<T> = string & { __returnType?: T };
export declare function s3ObjectResponseParam<T>(name: string): ParamType<T>;

export interface S3ObjectResponseOptions<AwsS3Client = S3Client>
	extends Pick<
		MiddyOptions<AwsS3Client, S3ClientConfig>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientAssumeRole"
		| "awsClientCapture"
		| "disablePrefetch"
	> {
	contextKey?: string;
	allowedHosts?: string[];
}

export type Context<
	TOptions extends S3ObjectResponseOptions | undefined = undefined,
> = ContextNamespace<
	TOptions,
	"s3-object-response",
	Promise<Response> | undefined
>;

declare function s3ObjectResponse<
	TOptions extends S3ObjectResponseOptions | undefined,
	TKey extends string = string,
>(
	// `TKey` keeps a `contextKey` literal from widening to `string`, so the
	// key narrows `middyContext` without `as const`.
	options?: TOptions & { contextKey?: TKey },
): middy.MiddlewareObj<unknown, unknown, Error, Context<TOptions>>;

export declare function s3ObjectResponseValidateOptions(
	options?: Record<string, unknown>,
): void;

export default s3ObjectResponse;
