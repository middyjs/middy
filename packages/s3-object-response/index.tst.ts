import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import s3ObjectResponse, { type Context } from "./index.js";

test("use with default options", () => {
	const middleware = s3ObjectResponse();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context>
	>();
});

test("use with all options", () => {
	const middleware = s3ObjectResponse({
		AwsClient: S3Client,
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("use with s3ObjectFetch context", () => {
	handler
		.use(
			s3ObjectResponse({
				AwsClient: S3Client,
				awsClientCapture: captureAWSv3Client,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.s3ObjectFetch).type.toBe<
				Promise<Response> | undefined
			>();
		});
});
