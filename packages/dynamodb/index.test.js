import {
	rejects as assertRejects,
	deepStrictEqual,
	ok,
	strictEqual,
	throws,
} from "node:assert/strict";
import { describe, test } from "node:test";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import middy from "@middy/core";
import { clearCache, getCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import dynamodb, { dynamodbValidateOptions } from "./index.js";

describe("@middy/dynamodb", () => {
	test.afterEach((t) => {
		t.mock.reset();
		clearCache();
	});

	const defaultEvent = {};
	const defaultContext = {
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
								pk: "0000",
							},
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
	});

	test("It should marshall a native Key before sending GetItemCommand", async (t) => {
		let receivedInput;
		mockClient(DynamoDBClient)
			.on(GetItemCommand)
			.callsFake(async (input) => {
				receivedInput = input;
				return {
					Item: {
						value: {
							S: "value",
						},
					},
				};
			});

		const handler = middy(() => {}).use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: "0000",
						},
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(receivedInput.Key, {
			pk: {
				S: "0000",
			},
		});
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
							Key: { pk: "0000" },
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
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
			strictEqual(request.context.middyContext.dynamodb.key?.value, "value");
		};

		const handler = middy(() => {})
			.use(
				dynamodb({
					AwsClient: DynamoDBClient,
					cacheExpiry: 0,
					fetchData: {
						key: {
							TableName: "table",
							Key: { pk: "0000" },
						},
					},
					setToContext: true,
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
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
								pk: "0000",
							},
						},
					},
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

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
								pk: "0000",
							},
						},
					},
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

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
							Key: { pk: "0000" },
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

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
						Key: { pk: "0000" },
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		);

		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			strictEqual(sendStub.callCount, 1);
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.errors, [new Error("timeout")]);
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
			await handler(defaultEvent, defaultContext);
		} catch (_e) {
			// Expected to fail
		}

		// Second call - only key2 is fetched (key1 is already cached)
		await handler(defaultEvent, defaultContext);

		// Should have called send 3 times total (key1 once, key2 twice)
		strictEqual(sendStub.callCount, 3);
	});

	test("It should resolve to undefined when GetItem returns no Item", async (t) => {
		mockClient(DynamoDBClient).on(GetItemCommand).resolvesOnce({});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.key, undefined);
		};

		const handler = middy(() => {})
			.use(
				dynamodb({
					AwsClient: DynamoDBClient,
					cacheExpiry: 0,
					fetchData: {
						key: {
							TableName: "table",
							Key: { pk: "0000" },
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
	});

	test("It should prefetch during cold start before the handler runs", async (t) => {
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

		// No disablePrefetch and a non-zero cacheExpiry => prefetch at factory time.
		middy(() => {}).use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: -1,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: "0000",
						},
					},
				},
			}),
		);

		// send must already have fired during construction, before any invocation.
		strictEqual(sendStub.callCount, 1);
	});

	test("It should build and capture the client once, inside the first invocation, when awsClientCapture is set", async (t) => {
		mockClient(DynamoDBClient)
			.on(GetItemCommand)
			.resolves({
				Item: {
					value: {
						S: "value",
					},
				},
			});

		const awsClientCapture = t.mock.fn((client) => client);

		const handler = middy(() => {}).use(
			dynamodb({
				AwsClient: DynamoDBClient,
				awsClientCapture,
				cacheExpiry: -1,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: "0000",
						},
					},
				},
			}),
		);

		strictEqual(awsClientCapture.mock.callCount(), 0);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		strictEqual(awsClientCapture.mock.callCount(), 1);
	});

	test("It should build the client once when prefetching", async (t) => {
		mockClient(DynamoDBClient)
			.on(GetItemCommand)
			.resolves({ Item: { value: { S: "value" } } });

		let instantiations = 0;
		class CountingClient extends DynamoDBClient {
			constructor(options) {
				super(options);
				instantiations++;
			}
		}

		const handler = middy(() => {}).use(
			dynamodb({
				AwsClient: CountingClient,
				cacheExpiry: -1,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: "0000",
						},
					},
				},
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		// The before hook reuses the prefetched client rather than building one.
		strictEqual(instantiations, 1);
	});

	test("It should not prefetch when cacheExpiry is 0", async (t) => {
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

		middy(() => {}).use(
			dynamodb({
				AwsClient: DynamoDBClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						TableName: "table",
						Key: {
							pk: "0000",
						},
					},
				},
			}),
		);

		strictEqual(sendStub.callCount, 0);
	});

	test("It should cache forever by default (cacheExpiry defaults to -1)", async (t) => {
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

		// cacheExpiry omitted => default -1 => cached forever.
		const handler = middy(() => {})
			.use(
				dynamodb({
					AwsClient: DynamoDBClient,
					fetchData: {
						key: {
							TableName: "table",
							Key: {
								pk: "0000",
							},
						},
					},
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		// Wait well past any short positive expiry; a -1 default must still serve
		// from cache, whereas a small positive default would have expired by now.
		await new Promise((resolve) => setTimeout(resolve, 25));
		await handler(defaultEvent, defaultContext);

		strictEqual(sendStub.callCount, 1);
	});

	test("It should not set value to context by default (setToContext defaults to false)", async (t) => {
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
			// setToContext omitted => default false => not assigned to context.
			strictEqual(request.context.middyContext.dynamodb, undefined);
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
								pk: "0000",
							},
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, { getRemainingTimeInMillis: () => 1000 });
	});

	test("It should export dynamoDbParam helper for TypeScript type inference", async (t) => {
		const { dynamoDbParam } = await import("./index.js");
		const mockRequest = { event: {}, context: {}, internal: {} };
		const result = dynamoDbParam(mockRequest);
		strictEqual(result, mockRequest);
	});

	test("dynamodbValidateOptions accepts valid options and rejects typos", () => {
		dynamodbValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
		dynamodbValidateOptions({});
		try {
			dynamodbValidateOptions({ cachExpiry: 60 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/dynamodb");
		}
	});

	test("dynamodbValidateOptions accepts cacheMaxSize and rejects values below 1", () => {
		dynamodbValidateOptions({ cacheMaxSize: 10 });
		try {
			dynamodbValidateOptions({ cacheMaxSize: 0 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("cacheMaxSize"));
		}
	});

	test("dynamodbValidateOptions rejects wrong type", () => {
		try {
			dynamodbValidateOptions({ fetchData: "no" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("fetchData"));
		}
	});

	test("dynamodbValidateOptions accepts optional GetItemCommand fields", () => {
		dynamodbValidateOptions({
			fetchData: {
				key: {
					TableName: "t",
					Key: { pk: "0" },
					AttributesToGet: ["a", "b"],
					ConsistentRead: true,
					ReturnConsumedCapacity: "TOTAL",
					ProjectionExpression: "#a, #b",
					ExpressionAttributeNames: { "#a": "a", "#b": "b" },
				},
			},
		});
	});

	test("dynamodbValidateOptions rejects invalid ReturnConsumedCapacity", () => {
		try {
			dynamodbValidateOptions({
				fetchData: {
					key: {
						TableName: "t",
						Key: { pk: "0" },
						ReturnConsumedCapacity: "BOGUS",
					},
				},
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
	});

	test("dynamodbValidateOptions rejects non-string AttributesToGet entry", () => {
		try {
			dynamodbValidateOptions({
				fetchData: {
					key: {
						TableName: "t",
						Key: { pk: "0" },
						AttributesToGet: ["ok", 42],
					},
				},
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
	});

	test("dynamodbValidateOptions accepts a valid AwsClient constructor", () => {
		dynamodbValidateOptions({ AwsClient: DynamoDBClient });
	});

	test("dynamodbValidateOptions rejects a non-function AwsClient", () => {
		try {
			dynamodbValidateOptions({ AwsClient: "DynamoDBClient" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("AwsClient"));
		}
	});

	test("dynamodbValidateOptions accepts a valid awsClientOptions object", () => {
		dynamodbValidateOptions({ awsClientOptions: { region: "us-east-1" } });
	});

	test("dynamodbValidateOptions rejects a non-object awsClientOptions", () => {
		try {
			dynamodbValidateOptions({ awsClientOptions: "us-east-1" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("awsClientOptions"));
		}
	});

	test("dynamodbValidateOptions accepts a valid awsClientAssumeRole string", () => {
		dynamodbValidateOptions({ awsClientAssumeRole: "roleCredentials" });
	});

	test("dynamodbValidateOptions rejects a non-string awsClientAssumeRole", () => {
		try {
			dynamodbValidateOptions({ awsClientAssumeRole: 42 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("awsClientAssumeRole"));
		}
	});

	test("dynamodbValidateOptions accepts a valid awsClientCapture function", () => {
		dynamodbValidateOptions({ awsClientCapture: (client) => client });
	});

	test("dynamodbValidateOptions rejects a non-function awsClientCapture", () => {
		try {
			dynamodbValidateOptions({ awsClientCapture: "capture" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("awsClientCapture"));
		}
	});

	test("dynamodbValidateOptions accepts a valid disablePrefetch boolean", () => {
		dynamodbValidateOptions({ disablePrefetch: true });
	});

	test("dynamodbValidateOptions rejects a non-boolean disablePrefetch", () => {
		try {
			dynamodbValidateOptions({ disablePrefetch: "yes" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("disablePrefetch"));
		}
	});

	test("dynamodbValidateOptions accepts a valid setToContext boolean", () => {
		dynamodbValidateOptions({ setToContext: true });
	});

	test("dynamodbValidateOptions rejects a non-boolean setToContext", () => {
		try {
			dynamodbValidateOptions({ setToContext: "yes" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("setToContext"));
		}
	});

	test("dynamodbValidateOptions accepts a valid cacheKeyExpiry mapping", () => {
		dynamodbValidateOptions({
			cacheKeyExpiry: { "@middy/dynamodb": 0 },
		});
	});

	test("dynamodbValidateOptions rejects a non-number cacheKeyExpiry value", () => {
		try {
			dynamodbValidateOptions({
				cacheKeyExpiry: { "@middy/dynamodb": "soon" },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("@middy/dynamodb"));
		}
	});

	test("dynamodbValidateOptions rejects a cacheKeyExpiry value below -1", () => {
		try {
			dynamodbValidateOptions({ cacheKeyExpiry: { "@middy/dynamodb": -2 } });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("@middy/dynamodb"));
		}
	});

	test("dynamodbValidateOptions accepts INDEXES ReturnConsumedCapacity", () => {
		dynamodbValidateOptions({
			fetchData: {
				key: {
					TableName: "t",
					Key: { pk: "0" },
					ReturnConsumedCapacity: "INDEXES",
				},
			},
		});
	});

	test("dynamodbValidateOptions accepts NONE ReturnConsumedCapacity", () => {
		dynamodbValidateOptions({
			fetchData: {
				key: {
					TableName: "t",
					Key: { pk: "0" },
					ReturnConsumedCapacity: "NONE",
				},
			},
		});
	});

	test("dynamodbValidateOptions requires TableName and Key on a fetchData entry", () => {
		try {
			dynamodbValidateOptions({
				fetchData: { key: { ConsistentRead: true } },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("TableName") || e.message.includes("Key"));
		}
	});

	const rejectsOptions = (options, message) => {
		throws(() => dynamodbValidateOptions(options), {
			name: "TypeError",
			message,
			cause: { package: "@middy/dynamodb" },
		});
	};
	const getItem = { TableName: "t", Key: { pk: "0" } };
	const withInput = (input) => ({
		fetchData: { key: { ...getItem, ...input } },
	});
	const unicodeText = /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;

	test("dynamodbValidateOptions rejects a fetchData key GetItem does not take", () => {
		rejectsOptions(
			withInput({ ExpressionAttributeValues: { ":v": { S: "x" } } }),
			"Unknown option 'fetchData.key.ExpressionAttributeValues'",
		);
	});

	test("dynamodbValidateOptions accepts every GetItem request parameter at its limit", () => {
		const options = withInput({
			TableName: "arn:aws:dynamodb:us-east-1:123456789012:table/My_Table.v-1",
			Key: { ["p".repeat(255)]: "v".repeat(2048), 名前: "値" },
			AttributesToGet: ["a".repeat(65535), "名前"],
			ConsistentRead: false,
			ProjectionExpression: `#a, b.c[0], ${"x".repeat(4084)}`,
			ExpressionAttributeNames: { [`#${"n".repeat(254)}`]: "a".repeat(65535) },
			ReturnConsumedCapacity: "TOTAL",
		});
		deepStrictEqual(dynamodbValidateOptions(options), options);
		const longTable = withInput({ TableName: "t".repeat(1024) });
		deepStrictEqual(dynamodbValidateOptions(longTable), longTable);
	});

	test("dynamodbValidateOptions accepts the native key values the docs show", () => {
		for (const Key of [
			{ pk: "tenant", sk: 42 },
			{ pk: 1.5, sk: -1 },
			{ pk: Number.MAX_SAFE_INTEGER, sk: -Number.MAX_SAFE_INTEGER },
		]) {
			const options = withInput({ Key });
			deepStrictEqual(dynamodbValidateOptions(options), options);
		}
	});

	test("dynamodbValidateOptions rejects key values marshall cannot write as a key", () => {
		for (const [value, message] of [
			[
				Number.MAX_SAFE_INTEGER + 2,
				`Option 'fetchData.key.Key.sk' must be <= ${Number.MAX_SAFE_INTEGER}`,
			],
			[
				-Number.MAX_SAFE_INTEGER - 2,
				`Option 'fetchData.key.Key.sk' must be >= -${Number.MAX_SAFE_INTEGER}`,
			],
			[true, "Option 'fetchData.key.Key.sk' must be string or number"],
			[null, "Option 'fetchData.key.Key.sk' must be string or number"],
			[["a"], "Option 'fetchData.key.Key.sk' must be string or number"],
			[{ S: "a" }, "Option 'fetchData.key.Key.sk' must be string or number"],
			[Number.NaN, "Option 'fetchData.key.Key.sk' must be string or number"],
			[
				new Uint8Array([1, 2]),
				"Option 'fetchData.key.Key.sk' must be string or number",
			],
		]) {
			rejectsOptions(withInput({ Key: { pk: "a", sk: value } }), message);
		}
	});

	test("dynamodbValidateOptions rejects GetItem parameters outside the AWS rules", () => {
		for (const [input, message] of [
			[
				{ TableName: "my table" },
				"Option 'fetchData.key.TableName' must match pattern /^[\\w.:/-]+$/u",
			],
			[
				{ TableName: "t".repeat(1025) },
				"Option 'fetchData.key.TableName' must have length <= 1024",
			],
			[
				{ Key: { pk: "0", sk: "1", extra: "2" } },
				"Option 'fetchData.key.Key' must have <= 2 properties",
			],
			[
				{ Key: { ["p".repeat(256)]: "0" } },
				`Invalid property name '${"p".repeat(256)}' in option 'fetchData.key.Key': Option 'fetchData.key.Key.${"p".repeat(256)}' must have length <= 255`,
			],
			[
				{ Key: { "p\nk": "0" } },
				`Invalid property name 'p\nk' in option 'fetchData.key.Key': Option 'fetchData.key.Key.p\nk' must match pattern ${unicodeText}`,
			],
			[
				{ Key: { pk: "a\nb" } },
				`Option 'fetchData.key.Key.pk' must match pattern ${unicodeText}`,
			],
			[
				{ Key: { pk: "v".repeat(2049) } },
				"Option 'fetchData.key.Key.pk' must have length <= 2048",
			],
			[
				{ AttributesToGet: [] },
				"Option 'fetchData.key.AttributesToGet' must have >= 1 items",
			],
			[
				{ AttributesToGet: ["a", "a"] },
				"Duplicate item at 'fetchData.key.AttributesToGet[1]'",
			],
			[
				{ AttributesToGet: ["a".repeat(65536)] },
				"Option 'fetchData.key.AttributesToGet[0]' must have length <= 65535",
			],
			[
				{ AttributesToGet: ["a\nb"] },
				`Option 'fetchData.key.AttributesToGet[0]' must match pattern ${unicodeText}`,
			],
			[
				{ AttributesToGet: Array.from({ length: 1025 }, (_, i) => `a${i}`) },
				"Option 'fetchData.key.AttributesToGet' must have <= 1024 items",
			],
			[
				{ ConsistentRead: "true" },
				"Option 'fetchData.key.ConsistentRead' must be boolean",
			],
			[
				{ ProjectionExpression: "x".repeat(4097) },
				"Option 'fetchData.key.ProjectionExpression' must have length <= 4096",
			],
			[
				{ ProjectionExpression: "#a,\n#b" },
				`Option 'fetchData.key.ProjectionExpression' must match pattern ${unicodeText}`,
			],
			[
				{ ExpressionAttributeNames: { a: "a" } },
				"Invalid property name 'a' in option 'fetchData.key.ExpressionAttributeNames': Option 'fetchData.key.ExpressionAttributeNames.a' must match pattern /^#\\w+$/u",
			],
			[
				{ ExpressionAttributeNames: { [`#${"n".repeat(255)}`]: "a" } },
				`Invalid property name '#${"n".repeat(255)}' in option 'fetchData.key.ExpressionAttributeNames': Option 'fetchData.key.ExpressionAttributeNames.#${"n".repeat(255)}' must have length <= 255`,
			],
			[
				{ ExpressionAttributeNames: { "#a": "a".repeat(65536) } },
				"Option 'fetchData.key.ExpressionAttributeNames.#a' must have length <= 65535",
			],
			[
				{ ExpressionAttributeNames: { "#a": "" } },
				`Option 'fetchData.key.ExpressionAttributeNames.#a' must match pattern ${unicodeText}`,
			],
			[
				{
					ExpressionAttributeNames: Object.fromEntries(
						Array.from({ length: 1025 }, (_, i) => [`#a${i}`, "a"]),
					),
				},
				"Option 'fetchData.key.ExpressionAttributeNames' must have <= 1024 properties",
			],
			[
				{ ReturnConsumedCapacity: "ALL" },
				'Option \'fetchData.key.ReturnConsumedCapacity\' must be one of ["INDEXES","TOTAL","NONE"]',
			],
		]) {
			rejectsOptions(withInput(input), message);
		}
		rejectsOptions(
			{ fetchData: { key: { TableName: "t" } } },
			"Missing required option 'fetchData.key.Key'",
		);
		rejectsOptions(
			{ fetchData: { key: { Key: { pk: "0" } } } },
			"Missing required option 'fetchData.key.TableName'",
		);
	});

	test("dynamodbValidateOptions bounds the fetchData map", () => {
		rejectsOptions(
			{ fetchData: { "bad key": getItem } },
			"Invalid property name 'bad key' in option 'fetchData': Option 'fetchData.bad key' must match pattern /^[\\x21-\\x7E]+$/u",
		);
		rejectsOptions(
			{
				fetchData: Object.fromEntries(
					Array.from({ length: 1025 }, (_, i) => [`k${i}`, getItem]),
				),
			},
			"Option 'fetchData' must have <= 1024 properties",
		);
	});

	test("dynamodbValidateOptions accepts the DynamoDBClient keys beyond the shared client config", () => {
		const fn = () => {};
		for (const awsClientOptions of [
			{
				region: "us-east-1",
				accountId: "123456789012",
				accountIdEndpointMode: "disabled",
				endpointCacheSize: 1000,
				endpointDiscoveryEnabled: true,
				endpointDiscoveryEnabledProvider: fn,
			},
			{ accountId: fn, accountIdEndpointMode: fn },
			{ accountIdEndpointMode: "preferred", endpointCacheSize: 0 },
			{
				accountIdEndpointMode: "required",
				endpointCacheSize: Number.MAX_SAFE_INTEGER,
			},
		]) {
			deepStrictEqual(dynamodbValidateOptions({ awsClientOptions }), {
				awsClientOptions,
			});
		}
	});

	test("dynamodbValidateOptions rejects DynamoDBClient keys outside their SDK types", () => {
		const oneOf = (key) =>
			`Option 'awsClientOptions.${key}' must match exactly one schema in oneOf`;
		for (const [awsClientOptions, message] of [
			[{ maxRetries: 3 }, "Unknown option 'awsClientOptions.maxRetries'"],
			[{ accountId: "12345678901" }, oneOf("accountId")],
			[{ accountId: "1234567890123" }, oneOf("accountId")],
			[{ accountIdEndpointMode: "always" }, oneOf("accountIdEndpointMode")],
			[
				{ endpointCacheSize: -1 },
				"Option 'awsClientOptions.endpointCacheSize' must be >= 0",
			],
			[
				{ endpointCacheSize: 1.5 },
				"Option 'awsClientOptions.endpointCacheSize' must be integer",
			],
			[
				{ endpointCacheSize: Number.MAX_SAFE_INTEGER + 1 },
				`Option 'awsClientOptions.endpointCacheSize' must be <= ${Number.MAX_SAFE_INTEGER}`,
			],
			[
				{ endpointDiscoveryEnabled: "true" },
				"Option 'awsClientOptions.endpointDiscoveryEnabled' must be boolean",
			],
			[
				{ endpointDiscoveryEnabledProvider: true },
				"Option 'awsClientOptions.endpointDiscoveryEnabledProvider' must be instanceof Function",
			],
		]) {
			rejectsOptions({ awsClientOptions }, message);
		}
	});

	test("dynamodbValidateOptions bounds the string options", () => {
		for (const key of ["awsClientAssumeRole", "cacheKey", "contextKey"]) {
			deepStrictEqual(dynamodbValidateOptions({ [key]: "k".repeat(1024) }), {
				[key]: "k".repeat(1024),
			});
			rejectsOptions(
				{ [key]: "k".repeat(1025) },
				`Option '${key}' must have length <= 1024`,
			);
			rejectsOptions(
				{ [key]: "a b" },
				`Option '${key}' must match pattern /^[\\x21-\\x7E]+$/u`,
			);
		}
	});

	test("dynamodbValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		dynamodbValidateOptions({ contextKey: "custom" });
		try {
			dynamodbValidateOptions({ contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should retry client init after a rejected attempt", async (t) => {
		let constructed = 0;
		class FlakyClient {
			constructor() {
				constructed++;
				if (constructed === 1) throw new Error("init boom");
			}
			send() {
				return Promise.resolve({ Item: { value: { S: "value" } } });
			}
		}
		const handler = middy(() => {}).use(
			dynamodb({
				AwsClient: FlakyClient,
				cacheExpiry: 0,
				fetchData: { key: { TableName: "table", Key: { pk: "0000" } } },
				disablePrefetch: true,
			}),
		);

		// A rejected init must not be memoized for the life of the container.
		await assertRejects(
			() => handler(defaultEvent, defaultContext),
			/init boom/,
		);
		await handler(defaultEvent, defaultContext);
		strictEqual(constructed, 2);
	});

	test("It should rebuild the client when the assumed-role credentials are refetched", async (t) => {
		const constructions = [];
		class FakeClient {
			constructor(awsClientOptions) {
				constructions.push(awsClientOptions);
			}
			send() {
				return Promise.resolve({ Item: { value: { S: "value" } } });
			}
		}
		let credentials = Promise.resolve({ accessKeyId: "a" });
		const handler = middy(() => {})
			.before((request) => {
				request.internal.role = credentials;
			})
			.use(
				dynamodb({
					AwsClient: FakeClient,
					awsClientAssumeRole: "role",
					cacheExpiry: 0,
					fetchData: { key: { TableName: "table", Key: { pk: "0000" } } },
				}),
			);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 1);
		deepStrictEqual(constructions[0].credentials, { accessKeyId: "a" });

		credentials = Promise.resolve({ accessKeyId: "b" });
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 2);
		deepStrictEqual(constructions[1].credentials, { accessKeyId: "b" });
	});

	test("It should keep a fresh value when a stale fetch fails after the entry was replaced", async (t) => {
		let call = 0;
		class StubClient {
			async send() {
				call++;
				if (call === 1) {
					await new Promise((resolve) => setTimeout(resolve, 60));
					throw new Error("stale failure");
				}
				return { Item: { value: { S: "fresh" } } };
			}
		}
		const middleware = dynamodb({
			AwsClient: StubClient,
			cacheKey: "ddb-stale-failure",
			cacheExpiry: 30,
			disablePrefetch: true,
			fetchData: { key: { TableName: "table", Key: { pk: "0000" } } },
		});
		const request = () => ({ event: {}, context: {}, internal: {} });
		const first = request();
		await middleware.before(first);
		first.internal.key.catch(() => {});

		await new Promise((resolve) => setTimeout(resolve, 40));
		const second = request();
		await middleware.before(second);
		deepStrictEqual(await second.internal.key, { value: "fresh" });

		// The first fetch fails at 60 ms, after the second replaced the entry.
		await new Promise((resolve) => setTimeout(resolve, 40));
		ok(getCache("ddb-stale-failure").value.key !== undefined);
		clearCache("ddb-stale-failure");
	});

	// A background refresh has no invocation to rebuild the client from, so it
	// would sign with the assumed-role credentials it started with. Under
	// awsClientAssumeRole none is scheduled; the next invocation refetches.
	test("It should not refresh in the background under awsClientAssumeRole", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		let sends = 0;
		class FakeClient {
			send() {
				sends++;
				return Promise.resolve({ Item: { value: { S: "value" } } });
			}
		}
		const handler = middy(() => {})
			.before((request) => {
				request.internal.role = Promise.resolve({ accessKeyId: "a" });
			})
			.use(
				dynamodb({
					AwsClient: FakeClient,
					awsClientAssumeRole: "role",
					cacheExpiry: 50,
					fetchData: { key: { TableName: "table", Key: { pk: "0000" } } },
				}),
			);

		await handler(defaultEvent, defaultContext);
		const afterFirst = sends;
		t.mock.timers.tick(120);
		await new Promise((resolve) => setImmediate(resolve));
		strictEqual(sends, afterFirst);

		await handler(defaultEvent, defaultContext);
		ok(sends > afterFirst);
	});
});
