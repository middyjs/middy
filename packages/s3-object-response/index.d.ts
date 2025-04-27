import type { ClientRequest } from "node:http";
import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";

export interface S3ObjectResponseOptions<AwsS3Client = S3Client>
	extends Pick<
		MiddyOptions<AwsS3Client, S3ClientConfig>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientAssumeRole"
		| "awsClientCapture"
		| "disablePrefetch"
	> {
	bodyType?: "stream" | "promise";
}

export type Context<TOptions extends S3ObjectResponseOptions | undefined> =
	LambdaContext & {
		s3Object: TOptions extends { bodyType: "stream" }
			? ClientRequest
			: TOptions extends { bodyType: "promise" }
				? Promise<any>
				: never;
	} & {
		s3ObjectFetch: Promise<Response>;
	};

export interface Internal extends Record<string, any> {
	s3ObjectResponse: {
		RequestRoute: string;
		RequestToken: string;
	};
}

declare function s3ObjectResponse<
	TOptions extends S3ObjectResponseOptions | undefined,
>(
	options?: TOptions,
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal>;

export default s3ObjectResponse;
