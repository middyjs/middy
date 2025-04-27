import { S3Client } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import s3, { type Context, s3Req } from ".";

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

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
	s3(),
);

// use with all options
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		Context<typeof options>,
		{ someS3Object: unknown }
	>
>(s3(options));

// use with setToContext: true
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		Context<typeof options> & { someS3Object: unknown },
		{ someS3Object: unknown }
	>
>(
	s3({
		...options,
		setToContext: true,
	}),
);

// @ts-expect-error - fetchData must be an object
s3({ ...options, fetchData: "not an object" });

s3({
	...options,
	fetchData: {
		someS3Object: {
			// @ts-expect-error - Valid bucket name is required
			Bucket: null,
			// @ts-expect-error - Valid key is required
			Key: null,
		},
	},
});

s3({
	...options,
	fetchData: {
		someS3Object: {
			Bucket: "bucket",
			Key: "path/to/key.ext",

			// @ts-expect-error - ChecksumMode is not a valid parameter
			ChecksumMode: "none",
		},
	},
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

handler
	.use(
		s3({
			...options,
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<unknown>(request.context.someS3Object);

		const data = await getInternal("someS3Object", request);
		expectType<unknown>(data.someS3Object);
	});

handler
	.use(
		s3({
			...options,
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("someS3Object", request);
		expectType<unknown>(data.someS3Object);
	});

handler
	.use(
		s3({
			...options,
			fetchData: {
				someS3Object: s3Req<{ param1: string; param2: string; param3: number }>(
					{
						Bucket: "bucket",
						Key: "path/to/key.json", // {key: 'value'}
					},
				),
			},
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<{ param1: string; param2: string; param3: number }>(
			request.context.someS3Object,
		);

		const data = await getInternal("someS3Object", request);
		expectType<{ param1: string; param2: string; param3: number }>(
			data.someS3Object,
		);
	});

handler
	.use(
		s3({
			...options,
			fetchData: {
				someS3Object: s3Req<{ param1: string; param2: string; param3: number }>(
					{
						Bucket: "bucket",
						Key: "path/to/key.json", // {key: 'value'}
					},
				),
			},
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("someS3Object", request);
		expectType<{ param1: string; param2: string; param3: number }>(
			data.someS3Object,
		);
	});
