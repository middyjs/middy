import type { ClientRequest } from "node:http";
import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import s3ObjectResponse, {
	type S3ObjectResponseOptions,
	type Context,
	type Internal,
} from ".";

// use with default options
let middleware = s3ObjectResponse();
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		Context<S3ObjectResponseOptions<S3Client> | undefined>,
		Internal
	>
>(middleware);

// use with all options
middleware = s3ObjectResponse({
	AwsClient: S3Client,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
});
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		Context<S3ObjectResponseOptions<S3Client> | undefined>,
		Internal
	>
>(middleware);

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

// use with bodyType: 'stream'
handler
	.use(
		s3ObjectResponse({
			AwsClient: S3Client,
			awsClientCapture: captureAWSv3Client,
			disablePrefetch: true,
			bodyType: "stream",
		}),
	)
	.before(async (request) => {
		expectType<ClientRequest>(request.context.s3Object);
		expectType<Promise<Response>>(request.context.s3ObjectFetch);

		const data = await getInternal("s3ObjectResponse", request);
		expectType<{
			RequestRoute: string;
			RequestToken: string;
		}>(data.s3ObjectResponse);
	});

// use with bodyType: 'promise'
handler
	.use(
		s3ObjectResponse({
			AwsClient: S3Client,
			awsClientCapture: captureAWSv3Client,
			disablePrefetch: true,
			bodyType: "promise",
		}),
	)
	.before(async (request) => {
		expectType<Promise<any>>(request.context.s3Object);
		expectType<Promise<Response>>(request.context.s3ObjectFetch);

		const data = await getInternal("s3ObjectResponse", request);
		expectType<{
			RequestRoute: string;
			RequestToken: string;
		}>(data.s3ObjectResponse);
	});
