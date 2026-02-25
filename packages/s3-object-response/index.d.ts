// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

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
	> {}

export type Context = LambdaContext & {
	s3ObjectFetch: Promise<Response> | undefined;
};

declare function s3ObjectResponse(
	options?: S3ObjectResponseOptions,
): middy.MiddlewareObj<unknown, any, Error, Context>;

export default s3ObjectResponse;
