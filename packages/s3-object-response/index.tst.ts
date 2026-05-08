import { S3Client } from "@aws-sdk/client-s3";
import type middy from "@middy/core";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import s3ObjectResponse from "./index.js";

test("use with default options", () => {
	const middleware = s3ObjectResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = s3ObjectResponse({
		AwsClient: S3Client,
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
