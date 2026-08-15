import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import ssm, { ssmValidateOptions } from "./index.js";

test.beforeEach((t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	event = {};
	context = {
		getRemainingTimeInMillis: () => 1000,
	};
});

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

let event = {};
let context = {};

test("It should set SSM param value to internal storage", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SSM param path to internal storage", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersByPathCommand)
		.resolvesOnce({
			Parameters: [
				{ Name: "/dev/service_name/key_name", Value: "key-value" },
				{ Name: "/dev/service_name/key_pass", Value: "key-pass" },
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.key, {
			key_name: "key-value",
			key_pass: "key-pass",
		});
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should handle SSM path response with missing Parameters field", async (t) => {
	// GetParametersByPathCommand may return a response with no Parameters
	// field when the path yields no results. Regression guard for
	// `for (const param of resp.Parameters ?? [])` at index.js.
	mockClient(SSMClient).on(GetParametersByPathCommand).resolvesOnce({});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.key, {});
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SSM param path to internal storage when nextToken is returned", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersByPathCommand, {
			Path: "/dev/service_name/",
			NextToken: undefined,
			Recursive: true,
			WithDecryption: true,
		})
		.resolvesOnce({
			NextToken: "NextToken",
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		})
		.on(GetParametersByPathCommand, {
			Path: "/dev/service_name/",
			NextToken: "NextToken",
			Recursive: true,
			WithDecryption: true,
		})
		.resolvesOnce({
			Parameters: [
				{
					Name: "/dev/service_name/key_pass",
					Value: "key,pass",
					Type: "StringList",
				},
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.key, {
			key_name: "key-value",
			key_pass: ["key", "pass"],
		});
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SSM param value to internal storage without prefetch", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SSM param value to context", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});

	const middleware = async (request) => {
		strictEqual(request.context.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

const ssmOrderTest = async (t, fetchData) => {
	mockClient(SSMClient)
		.on(GetParametersByPathCommand)
		.resolvesOnce({
			Parameters: [
				{
					Name: "/dev/service_name/path0",
					Value: "path-value-0",
				},
				{
					Name: "/dev/service_name/path1",
					Value: "path-value-1",
				},
			],
		})
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [
				{ Name: "/dev/service_name/key_name0", Value: "key-value-0" },
				{ Name: "/dev/service_name/key_name1", Value: "key-value-1" },
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(
			values,
			Object.assign(Object.create(null), {
				key0: "key-value-0",
				key1: "key-value-1",
				key2: { path0: "path-value-0", path1: "path-value-1" },
			}),
		);
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event);
};

test("It should set SSM param values to context with mix of paths and names [paths first]", async (t) => {
	await ssmOrderTest(t, {
		key2: "/dev/service_name/",
		key0: "/dev/service_name/key_name0",
		key1: "/dev/service_name/key_name1",
	});
});

test("It should set SSM param values to context with mix of paths and names [paths middle]", async (t) => {
	await ssmOrderTest(t, {
		key0: "/dev/service_name/key_name0",
		key2: "/dev/service_name/",
		key1: "/dev/service_name/key_name1",
	});
});

test("It should set SSM param values to context with mix of paths and names [paths last]", async (t) => {
	await ssmOrderTest(t, {
		key0: "/dev/service_name/key_name0",
		key1: "/dev/service_name/key_name1",
		key2: "/dev/service_name/",
	});
});

test("It should set SSM param value to internal storage when request > 10 params", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand, {
			Names: [
				"/dev/service_name/key_name0",
				"/dev/service_name/key_name1",
				"/dev/service_name/key_name2",
				"/dev/service_name/key_name3",
				"/dev/service_name/key_name4",
				"/dev/service_name/key_name5",
				"/dev/service_name/key_name6",
				"/dev/service_name/key_name7",
				"/dev/service_name/key_name8",
				"/dev/service_name/key_name9",
			],
			WithDecryption: true,
		})
		.resolvesOnce({
			Parameters: [
				{ Name: "/dev/service_name/key_name0", Value: "key-value0" },
				{ Name: "/dev/service_name/key_name1", Value: "key-value1" },
				{ Name: "/dev/service_name/key_name2", Value: "key-value2" },
				{ Name: "/dev/service_name/key_name3", Value: "key-value3" },
				{ Name: "/dev/service_name/key_name4", Value: "key-value4" },
				{ Name: "/dev/service_name/key_name5", Value: "key-value5" },
				{ Name: "/dev/service_name/key_name6", Value: "key-value6" },
				{ Name: "/dev/service_name/key_name7", Value: "key-value7" },
				{ Name: "/dev/service_name/key_name8", Value: "key-value8" },
				{ Name: "/dev/service_name/key_name9", Value: "key-value9" },
			],
		})

		.on(GetParametersCommand, {
			Names: [
				"/dev/service_name/key_name10",
				"/dev/service_name/key_name11",
				"/dev/service_name/key_name12",
				"/dev/service_name/key_name13",
				"/dev/service_name/key_name14",
			],
			WithDecryption: true,
		})
		.resolvesOnce({
			Parameters: [
				{ Name: "/dev/service_name/key_name10", Value: "key-value10" },
				{ Name: "/dev/service_name/key_name11", Value: "key-value11" },
				{ Name: "/dev/service_name/key_name12", Value: "key-value12" },
				{ Name: "/dev/service_name/key_name13", Value: "key-value13" },
				{ Name: "/dev/service_name/key_name14", Value: "key-value14" },
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key11, "key-value11");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key0: "/dev/service_name/key_name0",
					key1: "/dev/service_name/key_name1",
					key2: "/dev/service_name/key_name2",
					key3: "/dev/service_name/key_name3",
					key4: "/dev/service_name/key_name4",
					key5: "/dev/service_name/key_name5",
					key6: "/dev/service_name/key_name6",
					key7: "/dev/service_name/key_name7",
					key8: "/dev/service_name/key_name8",
					key9: "/dev/service_name/key_name9",
					key10: "/dev/service_name/key_name10",
					key11: "/dev/service_name/key_name11",
					key12: "/dev/service_name/key_name12",
					key13: "/dev/service_name/key_name13",
					key14: "/dev/service_name/key_name14",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set cross-account shared SSM param value to internal storage", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand, {
			Names: [
				"arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/key_name0",
			],
			WithDecryption: true,
		})
		.resolvesOnce({
			Parameters: [
				{
					ARN: "arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/key_name0",
					Name: "/dev/service_name/key_name0",
					Value: "key-value0",
				},
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key0, "key-value0");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key0: "arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/key_name0",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should reject (not silently resolve undefined) for an invalid cross-account ARN", async (t) => {
	const arn =
		"arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/missing";
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [],
			InvalidParameters: [arn],
		});

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: { key0: arn },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	await rejects(
		() => handler(event, context),
		/Failed to resolve internal values/,
	);
});

test("It should not call aws-sdk again if parameter is cached forever", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;
	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: -1,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 1);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 1000,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 1);
});

test("It should call aws-sdk everytime if cache disabled", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand, {
			Names: ["/dev/service_name/key_name"],
			WithDecryption: true,
		})
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand, {
			Names: ["/dev/service_name/key_name"],
			WithDecryption: true,
		})
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 4,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);
	await handler(event, context);
	t.mock.timers.tick(5);
	await handler(event, context);
	strictEqual(sendStub.callCount, 2);
});

test("It should it should recover from an error if cache enabled but cached param has expired", async (t) => {
	const awsError = new Error(
		"InvalidSignatureException: Signature expired: 20231103T171116Z is now earlier than 20231103T171224Z (20231103T171724Z - 5 min.)",
	);
	awsError.__type = "InvalidSignatureException";
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand, {
			Names: ["/dev/service_name/key_name"],
			WithDecryption: true,
		})
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		})
		.rejectsOnce(awsError)
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 4,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	t.mock.timers.tick(5);
	await handler(event, context);
	t.mock.timers.tick(5);
	await handler(event, context);

	strictEqual(sendStub.callCount, 4);
});

test("It should throw error if InvalidParameters returned", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			InvalidParameters: [
				"invalid-ssm-param-name",
				"another-invalid-ssm-param",
			],
		});

	const handler = middy(() => {}).use(
		ssm({
			AwsClient: SSMClient,
			cacheExpiry: 0,
			fetchData: {
				a: "invalid-ssm-param-name",
				b: "another-invalid-ssm-param",
				key: "/dev/service_name/key_name",
			},
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	try {
		await handler(event, context);
		ok(false);
	} catch (e) {
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [
			new Error("InvalidParameter invalid-ssm-param-name", {
				cause: { package: "@middy/ssm" },
			}),
			new Error("InvalidParameter another-invalid-ssm-param", {
				cause: { package: "@middy/ssm" },
			}),
		]);
	}
});

test("It should catch if an error is returned from fetchSingle", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		ssm({
			AwsClient: SSMClient,
			cacheExpiry: 0,
			fetchData: {
				key: "/dev/service_name/key_name",
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

test("It should catch if an error is returned from fetchPath", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersByPathCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		ssm({
			AwsClient: SSMClient,
			cacheExpiry: 0,
			fetchData: {
				path: "/dev/service_path/",
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

test("It should skip fetching already cached path values", async (t) => {
	let callCount = 0;
	const mockService = mockClient(SSMClient)
		.on(GetParametersByPathCommand)
		.callsFake(async (input) => {
			callCount++;
			// First call for path1 succeeds
			if (callCount === 1 && input.Path === "/dev/path1/") {
				return {
					Parameters: [
						{
							Name: "/dev/path1/key",
							Value: "value1",
						},
					],
				};
			}
			// Second call for path2 fails
			if (callCount === 2 && input.Path === "/dev/path2/") {
				throw new Error("timeout");
			}
			// Third call only fetches path2 (path1 is cached)
			if (callCount === 3 && input.Path === "/dev/path2/") {
				return {
					Parameters: [
						{
							Name: "/dev/path2/key",
							Value: "value2",
						},
					],
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.path1.key, "value1");
		strictEqual(values.path2.key, "value2");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 1000,
				fetchData: {
					path1: "/dev/path1/",
					path2: "/dev/path2/",
				},
			}),
		)
		.before(middleware);

	// First call - path1 succeeds, path2 fails
	try {
		await handler(event, context);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only path2 is fetched (path1 is already cached)
	await handler(event, context);

	// Should have called send 3 times total
	strictEqual(sendStub.callCount, 3);
});

test("It should skip fetching an already cached named value on a modified-cache re-run", async (t) => {
	// A named key (GetParametersCommand) succeeds and is cached; a sibling path
	// key (GetParametersByPathCommand) fails, marking the cache modified so the
	// next invocation re-runs fetch with the cached values. The already-resolved
	// named key must be skipped (index.js line 88) and NOT re-requested.
	let nameCalls = 0;
	let pathCalls = 0;
	const mockService = mockClient(SSMClient);
	mockService.on(GetParametersCommand).callsFake(async () => {
		nameCalls++;
		return {
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		};
	});
	mockService.on(GetParametersByPathCommand).callsFake(async () => {
		pathCalls++;
		if (pathCalls === 1) {
			throw new Error("timeout");
		}
		return {
			Parameters: [{ Name: "/dev/path/key", Value: "path-value" }],
		};
	});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.named, "key-value");
		strictEqual(values.path.key, "path-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 1000,
				fetchData: {
					named: "/dev/service_name/key_name",
					path: "/dev/path/",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	// First invocation: named resolves & caches, path rejects -> cache modified.
	try {
		await handler(event, context);
	} catch (_e) {
		// expected
	}
	// Second invocation: named is already cached -> skipped (no new request);
	// only the path is re-fetched.
	await handler(event, context);

	// named fetched exactly once; path fetched twice.
	strictEqual(nameCalls, 1);
	strictEqual(pathCalls, 2);
});

test("It should clear failed named batch from cache so the next invocation refetches", async (t) => {
	// On a batch failure the failed keys must be cleared from cache (index.js
	// line 133). Otherwise the rejected promise lingers and a later cached
	// invocation would resolve the stale rejection instead of refetching.
	let calls = 0;
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.callsFake(async () => {
			calls++;
			if (calls === 1) {
				throw new Error("timeout");
			}
			return {
				Parameters: [
					{ Name: "/dev/service_name/key_name", Value: "key-value" },
				],
			};
		});

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 1000,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.key, "key-value");
		});

	// First invocation fails.
	await rejects(
		() => handler(event, context),
		/Failed to resolve internal values/,
	);
	// Second invocation must refetch (cache was cleared) and succeed.
	await handler(event, context);

	strictEqual(calls, 2);
});

test("It should resolve single-batch named values to undefined when Parameters is missing", async (t) => {
	// GetParametersCommand may return a response without a Parameters field.
	// Guards `for (const param of resp.Parameters ?? [])` at index.js (single).
	mockClient(SSMClient).on(GetParametersCommand).resolvesOnce({});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, undefined);
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should look up a non-ARN named value directly, not via the ARN suffix branch", async (t) => {
	// A non-ARN fetchKey must resolve by exact name (index.js line 149), not by
	// entering the ARN-suffix matching branch. Here a sibling param's name is a
	// `:parameter<name>` suffix of the fetchKey; the ARN branch would mis-select
	// it. Guards the `fetchKey.startsWith("arn:aws:ssm:")` condition.
	const fetchKey = "weird:parameter/dev/service_name/key_name";
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [
				{ Name: "/dev/service_name/key_name", Value: "wrong-value" },
				{ Name: fetchKey, Value: "correct-value" },
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "correct-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: fetchKey,
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should map multiple cross-account ARNs to the correct values by suffix", async (t) => {
	// Two ARNs in one batch. The branch matches each param by its
	// `:parameter<Name>` suffix; a first-match would mis-map key1 to key0's
	// value. Guards the ARN matching at index.js (startsWith + template).
	const arn0 =
		"arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/key_name0";
	const arn1 =
		"arn:aws:ssm:us-east-1:000000000000:parameter/dev/service_name/key_name1";
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [
				{
					ARN: arn0,
					Name: "/dev/service_name/key_name0",
					Value: "key-value0",
				},
				{
					ARN: arn1,
					Name: "/dev/service_name/key_name1",
					Value: "key-value1",
				},
			],
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key0, "key-value0");
		strictEqual(values.key1, "key-value1");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key0: arn0,
					key1: arn1,
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should export ssmParam helper for TypeScript type inference", async (t) => {
	const { ssmParam } = await import("./index.js");
	const paramName = "/test/param";
	const result = ssmParam(paramName);
	strictEqual(result, paramName);
});

test("ssmValidateOptions should accept valid options", () => {
	ssmValidateOptions({
		AwsClient: SSMClient,
		cacheExpiry: 0,
		fetchData: { key: "/dev/param" },
		disablePrefetch: true,
		setToContext: false,
		awsRequestLimit: 10,
	});
});

test("ssmValidateOptions should accept empty options", () => {
	ssmValidateOptions({});
	ssmValidateOptions();
});

test("ssmValidateOptions should throw on unknown key (typo)", () => {
	try {
		ssmValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cachExpiry"));
		strictEqual(e.cause.package, "@middy/ssm");
	}
});

test("ssmValidateOptions should throw when fetchData is not an object", () => {
	try {
		ssmValidateOptions({ fetchData: "no" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("fetchData"));
		strictEqual(e.cause.package, "@middy/ssm");
	}
});

test("ssmValidateOptions should throw when cacheExpiry is below -1", () => {
	try {
		ssmValidateOptions({ cacheExpiry: -5 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("cacheExpiry"));
	}
});

test("ssmValidateOptions should throw when awsRequestLimit is zero", () => {
	try {
		ssmValidateOptions({ awsRequestLimit: 0 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsRequestLimit"));
	}
});

test("ssmValidateOptions should throw when setToContext is not boolean", () => {
	try {
		ssmValidateOptions({ setToContext: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("setToContext"));
	}
});

test("ssmValidateOptions should accept a valid awsClientOptions object", () => {
	ssmValidateOptions({ awsClientOptions: { region: "us-east-1" } });
});

test("ssmValidateOptions should throw when awsClientOptions is not an object", () => {
	try {
		ssmValidateOptions({ awsClientOptions: "no" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientOptions"));
	}
});

test("ssmValidateOptions should accept a valid awsClientAssumeRole string", () => {
	ssmValidateOptions({ awsClientAssumeRole: "credentials" });
});

test("ssmValidateOptions should throw when awsClientAssumeRole is not a string", () => {
	try {
		ssmValidateOptions({ awsClientAssumeRole: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientAssumeRole"));
	}
});

test("ssmValidateOptions should accept a valid awsClientCapture function", () => {
	ssmValidateOptions({ awsClientCapture: (client) => client });
});

test("ssmValidateOptions should throw when awsClientCapture is not a function", () => {
	try {
		ssmValidateOptions({ awsClientCapture: "no" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientCapture"));
	}
});

test("ssmValidateOptions should accept a valid cacheKey string", () => {
	ssmValidateOptions({ cacheKey: "my-cache-key" });
});

test("ssmValidateOptions should throw when cacheKey is not a string", () => {
	try {
		ssmValidateOptions({ cacheKey: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("cacheKey"));
	}
});

test("ssmValidateOptions should accept a cacheKeyExpiry object whose values are numbers >= -1", () => {
	ssmValidateOptions({ cacheKeyExpiry: { "@middy/ssm": 0 } });
	ssmValidateOptions({ cacheKeyExpiry: { "@middy/ssm": -1 } });
});

test("ssmValidateOptions should throw when cacheKeyExpiry is not an object", () => {
	try {
		ssmValidateOptions({ cacheKeyExpiry: "no" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("cacheKeyExpiry"));
	}
});

test("ssmValidateOptions should throw when a cacheKeyExpiry value is not a number", () => {
	try {
		ssmValidateOptions({ cacheKeyExpiry: { "@middy/ssm": "no" } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("@middy/ssm"));
	}
});

test("ssmValidateOptions should throw when a cacheKeyExpiry value is below -1", () => {
	try {
		ssmValidateOptions({ cacheKeyExpiry: { "@middy/ssm": -2 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("@middy/ssm"));
	}
});

// --- defaults coverage ---

test("It should prefetch by default (disablePrefetch defaults to false)", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		ssm({
			AwsClient: SSMClient,
			fetchData: {
				key: "/dev/service_name/key_name",
			},
		}),
	);

	// With prefetch enabled (the default), the request fires at factory time,
	// before the handler is ever invoked. With disablePrefetch:true it would
	// only fire on the first invocation.
	strictEqual(sendStub.callCount, 1);

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};
	handler.before(middleware);

	await handler(event, context);
	strictEqual(sendStub.callCount, 1);
});

test("It should reuse the prefetched client and not recreate it on invocation", async (t) => {
	// When prefetch created the client at factory time, the before-hook must
	// reuse it (index.js `if (!client)` guard) rather than constructing a new
	// AWS client on every invocation.
	let ctorCount = 0;
	class CountingSSMClient extends SSMClient {
		constructor(...args) {
			super(...args);
			ctorCount++;
		}
	}
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: CountingSSMClient,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.key, "key-value");
		});

	// Prefetch constructed exactly one client.
	strictEqual(ctorCount, 1);
	await handler(event, context);
	// No additional client constructed during invocation.
	strictEqual(ctorCount, 1);
});

test("It should cache forever by default (cacheExpiry defaults to -1)", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolves({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	// Advance well past any positive expiry window; with the -1 default the
	// cached value never expires so no second fetch occurs.
	t.mock.timers.tick(60000);
	await handler(event, context);

	strictEqual(sendStub.callCount, 1);
});

test("It should not set values to context by default (setToContext defaults to false)", async (t) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});

	const middleware = async (request) => {
		// Default setToContext is false: the value must NOT be copied to context.
		strictEqual(request.context.key, undefined);
		const values = await getInternal(true, request);
		strictEqual(values.key, "key-value");
	};

	const handler = middy(() => {})
		.use(
			ssm({
				AwsClient: SSMClient,
				cacheExpiry: 0,
				fetchData: {
					key: "/dev/service_name/key_name",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});
