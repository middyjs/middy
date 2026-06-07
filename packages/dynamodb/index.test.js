import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import dynamodb, { dynamodbValidateOptions } from "./index.js";

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
		await handler(defaultEvent, defaultContext);
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

test("It should reuse the prefetched client instead of recreating it per invocation", async (t) => {
	mockClient(DynamoDBClient)
		.on(GetItemCommand)
		.resolves({
			Item: {
				value: {
					S: "value",
				},
			},
		});

	// With prefetch active and awsClientCapture set, createPrefetchClient warns
	// once at cold start. If the before middleware recreated the client on every
	// invocation it would warn again, so warn must stay at exactly one.
	const warn = t.mock.method(console, "warn", () => {});

	const handler = middy(() => {}).use(
		dynamodb({
			AwsClient: DynamoDBClient,
			awsClientCapture: (client) => client,
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

	strictEqual(warn.mock.callCount(), 1);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(warn.mock.callCount(), 1);
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
		strictEqual(request.context.key, undefined);
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
				Key: { pk: { S: "0" } },
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
					Key: { pk: { S: "0" } },
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
					Key: { pk: { S: "0" } },
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
		dynamodbValidateOptions({ cacheKeyExpiry: { "@middy/dynamodb": "soon" } });
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
				Key: { pk: { S: "0" } },
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
				Key: { pk: { S: "0" } },
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

test("dynamodbValidateOptions allows additional native GetItemCommand fields", () => {
	dynamodbValidateOptions({
		fetchData: {
			key: {
				TableName: "t",
				Key: { pk: { S: "0" } },
				ExpressionAttributeValues: { ":v": { S: "x" } },
			},
		},
	});
});
