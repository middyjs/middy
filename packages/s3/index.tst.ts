import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import s3, { type Context, s3Param } from "./index.js";

const options = {
	AwsClient: S3Client,
	awsClientOptions: {
		credentials: {
			secretAccessKey: "secret",
			sessionToken: "token",
			accessKeyId: "key",
		},
	},
	awsClientAssumeRole: "some-role",
	awsClientCapture: captureAWSv3Client,
	fetchData: {
		someS3Object: {
			Bucket: "bucket",
			Key: "path/to/key.json", // {key: 'value'}
		},
	},
	disablePrefetch: true,
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	setToContext: false,
};

test("use with default options", () => {
	expect(s3()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	expect(s3(options)).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<typeof options>,
			{ someS3Object: unknown }
		>
	>();
});

test("use with setToContext: true", () => {
	expect(
		s3({
			...options,
			setToContext: true,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<typeof options> & { someS3Object: unknown },
			{ someS3Object: unknown }
		>
	>();
});

expect(s3).type.not.toBeCallableWith({
	...options,
	fetchData: "not an object", // fetchData must be an object
});

expect(s3).type.not.toBeCallableWith({
	...options,
	fetchData: {
		someS3Object: {
			Bucket: null, // Valid bucket name is required
			Key: null, // Valid key is required
		},
	},
});

expect(s3).type.not.toBeCallableWith({
	...options,
	fetchData: {
		someS3Object: {
			Bucket: "bucket",
			Key: "path/to/key.ext",
			ChecksumMode: "none", // ChecksumMode is not a valid parameter
		},
	},
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("setToContext: true", () => {
	handler
		.use(
			s3({
				...options,
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.someS3Object).type.toBe<unknown>();

			const data = await getInternal("someS3Object", request);
			expect(data.someS3Object).type.toBe<unknown>();
		});
});

test("setToContext: false", () => {
	handler
		.use(
			s3({
				...options,
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("someS3Object", request);
			expect(data.someS3Object).type.toBe<unknown>();
		});
});

test("s3Param with setToContext: true", () => {
	handler
		.use(
			s3({
				...options,
				fetchData: {
					someS3Object: s3Param<{
						param1: string;
						param2: string;
						param3: number;
					}>({
						Bucket: "bucket",
						Key: "path/to/key.json", // {key: 'value'}
					}),
				},
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.someS3Object).type.toBe<{
				param1: string;
				param2: string;
				param3: number;
			}>();

			const data = await getInternal("someS3Object", request);
			expect(data.someS3Object).type.toBe<{
				param1: string;
				param2: string;
				param3: number;
			}>();
		});
});

test("s3Param with setToContext: false", () => {
	handler
		.use(
			s3({
				...options,
				fetchData: {
					someS3Object: s3Param<{
						param1: string;
						param2: string;
						param3: number;
					}>({
						Bucket: "bucket",
						Key: "path/to/key.json", // {key: 'value'}
					}),
				},
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("someS3Object", request);
			expect(data.someS3Object).type.toBe<{
				param1: string;
				param2: string;
				param3: number;
			}>();
		});
});
