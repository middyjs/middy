import type { ClientRequest } from "node:http";
import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import s3ObjectResponse, {
	type Context,
	type Internal,
	type S3ObjectResponseOptions,
} from "./index.js";

test("use with default options", () => {
	const middleware = s3ObjectResponse();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			Context<S3ObjectResponseOptions<S3Client> | undefined>,
			Internal
		>
	>();
});

test("use with all options", () => {
	const middleware = s3ObjectResponse({
		AwsClient: S3Client,
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			Context<S3ObjectResponseOptions<S3Client> | undefined>,
			Internal
		>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("use with bodyType: 'stream'", () => {
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
			expect(request.context.s3Object).type.toBe<ClientRequest>();
			expect(request.context.s3ObjectFetch).type.toBe<Promise<Response>>();

			const data = await getInternal("s3ObjectResponse", request);
			expect(data.s3ObjectResponse).type.toBe<{
				RequestRoute: string;
				RequestToken: string;
			}>();
		});
});

test("use with bodyType: 'promise'", () => {
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
			expect(request.context.s3Object).type.toBe<Promise<any>>();
			expect(request.context.s3ObjectFetch).type.toBe<Promise<Response>>();

			const data = await getInternal("s3ObjectResponse", request);
			expect(data.s3ObjectResponse).type.toBe<{
				RequestRoute: string;
				RequestToken: string;
			}>();
		});
});
