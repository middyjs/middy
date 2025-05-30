import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import ssm from "./index.js";

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
		equal(values.key, "key-value");
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
		deepEqual(values.key, {
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
		deepEqual(values.key, {
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
		equal(values.key, "key-value");
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
		equal(request.context.key, "key-value");
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
		deepEqual(values, {
			key0: "key-value-0",
			key1: "key-value-1",
			key2: { path0: "path-value-0", path1: "path-value-1" },
		});
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

test("It should set SSM param values to context with mix of paths and names [paths first]", (t) => {
	ssmOrderTest(t, {
		key2: "/dev/service_name/",
		key0: "/dev/service_name/key_name0",
		key1: "/dev/service_name/key_name1",
	});
});

test("It should set SSM param values to context with mix of paths and names [paths middle]", (t) => {
	ssmOrderTest(t, {
		key0: "/dev/service_name/key_name0",
		key2: "/dev/service_name/",
		key1: "/dev/service_name/key_name1",
	});
});

test("It should set SSM param values to context with mix of paths and names [paths last]", (t) => {
	ssmOrderTest(t, {
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
		equal(values.key11, "key-value11");
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

test("It should not call aws-sdk again if parameter is cached forever", async (t) => {
	const mockService = mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolvesOnce({
			Parameters: [{ Name: "/dev/service_name/key_name", Value: "key-value" }],
		});
	const sendStub = mockService.send;
	const middleware = async (request) => {
		const values = await getInternal(true, request);
		equal(values.key, "key-value");
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

	equal(sendStub.callCount, 1);
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
		equal(values.key, "key-value");
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

	equal(sendStub.callCount, 1);
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
		equal(values.key, "key-value");
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

	equal(sendStub.callCount, 2);
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
		equal(values.key, "key-value");
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
	equal(sendStub.callCount, 2);
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
		equal(values.key, "key-value");
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

	equal(sendStub.callCount, 4);
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
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [
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
		equal(sendStub.callCount, 1);
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [new Error("timeout")]);
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
		equal(sendStub.callCount, 1);
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [new Error("timeout")]);
	}
});
