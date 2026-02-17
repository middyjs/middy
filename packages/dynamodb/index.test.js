import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import dynamodb from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set DynamoDB param value to internal storage", async (t) => {
	mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolvesOnce({
			Item: {
				value: {
					S: "value",
				},
			},
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set DynamoDB param value to internal storage without prefetch", async (t) => {
	mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolvesOnce({
			Item: {
				value: {
					S: "value",
				},
			},
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set DynamoDB param value to context", async (t) => {
	mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolvesOnce({
			Item: {
				value: {
					S: "value",
				},
			},
		});

	const middleware = async (request) => {
		strictEqual(request.context.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
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
	const mockService = mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolvesOnce({
			Item: {
				value: {
					S: "value",
				},
			},
		});
	const sendStub = mockService.send;
	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: -1,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
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
	const mockService = mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolvesOnce({
			Item: {
				value: {
					S: "value",
				},
			},
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 1000,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
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
	const mockService = mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolves({
			Item: {
				value: {
					S: "value",
				},
			},
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.value, "value");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: {
								S: "0000",
							},
						},
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
	const mockService = mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		dynamodb({
			AwsClient: DynamoDBClient,
			cacheExpiry: 0,
			fetchData: {
				key: {
					TableName: "table",
					Key: {
						pk: {
							S: "0000",
						},
					},
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
	const mockService = mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.callsFake(async (input) => {
			callCount++;
			// First call for key1 succeeds
			if (callCount === 1) {
				return {
					Item: {
						value: {
							S: "value1",
						},
					},
				};
			}
			// First call for key2 fails
			if (callCount === 2) {
				throw new Error("timeout");
			}
			// Second call only fetches key2 (key1 is cached)
			if (callCount === 3) {
				return {
					Item: {
						value: {
							S: "value2",
						},
					},
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.value, "value1");
		strictEqual(values.key2?.value, "value2");
	};

	const handler = middy(() => {})
		.use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 1000,
				fetchData: {
					key1: {
						TableName: "table",
						Key: {
							pk: "0001",
						},
					},
					key2: {
						TableName: "table",
						Key: {
							pk: "0002",
						},
					},
				},
			}),
		)
		.before(middleware);

	// First call - key1 succeeds, key2 fails
	try {
		await handler(event, context);
	} catch (e) {
		// Expected to fail
	}

	// Second call - only key2 is fetched (key1 is already cached)
	await handler(event, context);

	// Should have called send 3 times total (key1 once, key2 twice)
	strictEqual(sendStub.callCount, 3);
});

test("It should export dynamoDbParam helper for TypeScript type inference", async (t) => {
	const { dynamoDbParam } = await import("./index.js");
	const mockRequest = { event: {}, context: {}, internal: {} };
	const result = dynamoDbParam(mockRequest);
	strictEqual(result, mockRequest);
});
