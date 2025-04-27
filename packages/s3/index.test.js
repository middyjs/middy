import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import s3 from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

const s3Response = (content) => {
	return {
		transformToString: async () => content,
	};
};

test("It should set S3 param value to internal storage", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set S3 param value to string when no ContentType is returned", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key, '{"option":"value"}');
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set S3 param value to context", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		equal(request.context.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should not call aws-sdk again if parameter is cached forever", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;
	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: -1,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	equal(sendStub.callCount, 1);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 1000,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	equal(sendStub.callCount, 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	equal(sendStub.callCount, 2);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		s3({
			AwsClient: S3Client,
			cacheExpiry: 0,
			fetchData: {
				key: {
					Bucket: "...",
					Key: "...",
				},
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	try {
		await handler(event, context);
	} catch (e) {
		equal(sendStub.callCount, 1);
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [new Error("timeout")]);
	}
});
