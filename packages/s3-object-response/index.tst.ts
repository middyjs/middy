import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import s3ObjectResponse, { type Context } from "./index.js";

test("use with default options", () => {
	const middleware = s3ObjectResponse();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const middleware = s3ObjectResponse({
		AwsClient: S3Client,
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
		contextKey: "s3-object-response",
		allowedHosts: [".amazonaws.com", "minio.internal"],
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("allowedHosts must be a list of hostnames", () => {
	expect(s3ObjectResponse).type.not.toBeCallableWith({
		allowedHosts: ".amazonaws.com",
	});
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("default contextKey types middyContext", () => {
	handler.use(s3ObjectResponse()).before(async (request) => {
		expect(request.context.middyContext["s3-object-response"]).type.toBe<
			Promise<Response> | undefined
		>();
	});
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(s3ObjectResponse({ contextKey: "custom" }))
		.before(async (request) => {
			expect(request.context.middyContext.custom).type.toBe<
				Promise<Response> | undefined
			>();
		});
});
