import { deepStrictEqual, strictEqual } from "node:assert/strict";
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
		strictEqual(values.key?.option, "value");
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
		strictEqual(values.key, '{"option":"value"}');
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
		strictEqual(request.context.key?.option, "value");
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
		strictEqual(values.key?.option, "value");
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

	strictEqual(sendStub.callCount, 1);
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
		strictEqual(values.key?.option, "value");
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

	strictEqual(sendStub.callCount, 1);
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
		strictEqual(values.key?.option, "value");
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

	strictEqual(sendStub.callCount, 2);
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
		strictEqual(sendStub.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.callsFake(async () => {
			callCount++;
			// First call for key1 succeeds
			if (callCount === 1) {
				return {
					ContentType: "application/json",
					Body: s3Response('{"option":"value1"}'),
				};
			}
			// First call for key2 fails
			if (callCount === 2) {
				throw new Error("timeout");
			}
			// Second call only fetches key2 (key1 is cached)
			if (callCount === 3) {
				return {
					ContentType: "application/json",
					Body: s3Response('{"option":"value2"}'),
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.option, "value1");
		strictEqual(values.key2?.option, "value2");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 1000,
				fetchData: {
					key1: {
						Bucket: "bucket1",
						Key: "key1",
					},
					key2: {
						Bucket: "bucket2",
						Key: "key2",
					},
				},
			}),
		)
		.before(middleware);

	// First call - key1 succeeds, key2 fails
	try {
		await handler(event, context);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only key2 is fetched (key1 is already cached)
	await handler(event, context);

	// Should have called send 3 times total (key1 once, key2 twice)
	strictEqual(sendStub.callCount, 3);
});

test("It should export s3Param helper for TypeScript type inference", async (t) => {
	const { s3Param } = await import("./index.js");
	const mockRequest = { event: {}, context: {}, internal: {} };
	const result = s3Param(mockRequest);
	strictEqual(result, mockRequest);
});
