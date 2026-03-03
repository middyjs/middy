import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import sts from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set credential to internal storage", async (t) => {
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolvesOnce({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.role, {
			accessKeyId: "accessKeyId",
			secretAccessKey: "secretAccessKey",
			sessionToken: "sessionToken",
		});
	};

	handler
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: 0,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should set STS secret to internal storage without prefetch", async (t) => {
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolvesOnce({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.role, {
			accessKeyId: "accessKeyId",
			secretAccessKey: "secretAccessKey",
			sessionToken: "sessionToken",
		});
	};

	handler
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: 0,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should set STS secret to context", async (t) => {
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolvesOnce({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		deepStrictEqual(request.context.role, {
			accessKeyId: "accessKeyId",
			secretAccessKey: "secretAccessKey",
			sessionToken: "sessionToken",
		});
	};

	handler
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: 0,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolvesOnce({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});
	const sendStub = mockService.send;

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.role, {
			accessKeyId: "accessKeyId",
			secretAccessKey: "secretAccessKey",
			sessionToken: "sessionToken",
		});
	};

	handler
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: -1,
				fetchData: {
					role: {
						RoleArn: ".../role",
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
	const mockService = mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolves({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});
	const sendStub = mockService.send;

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.role, {
			accessKeyId: "accessKeyId",
			secretAccessKey: "secretAccessKey",
			sessionToken: "sessionToken",
		});
	};

	handler
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: 0,
				fetchData: {
					role: {
						RoleArn: ".../role",
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
	const mockService = mockClient(STSClient)
		.on(AssumeRoleCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		sts({
			AwsClient: STSClient,
			cacheExpiry: 0,
			fetchData: {
				role: {
					RoleArn: ".../role",
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
	const mockService = mockClient(STSClient)
		.on(AssumeRoleCommand)
		.callsFake(async () => {
			callCount++;
			// First call for role1 succeeds
			if (callCount === 1) {
				return {
					Credentials: {
						AccessKeyId: "accessKeyId1",
						SecretAccessKey: "secretAccessKey",
						SessionToken: "sessionToken",
					},
				};
			}
			// First call for role2 fails
			if (callCount === 2) {
				throw new Error("timeout");
			}
			// Second call only fetches role2 (role1 is cached)
			if (callCount === 3) {
				return {
					Credentials: {
						AccessKeyId: "accessKeyId2",
						SecretAccessKey: "secretAccessKey",
						SessionToken: "sessionToken",
					},
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.role1.accessKeyId, "accessKeyId1");
		strictEqual(values.role2.accessKeyId, "accessKeyId2");
	};

	const handler = middy(() => {})
		.use(
			sts({
				AwsClient: STSClient,
				cacheExpiry: 1000,
				fetchData: {
					role1: {
						RoleArn: ".../role1",
					},
					role2: {
						RoleArn: ".../role2",
					},
				},
			}),
		)
		.before(middleware);

	// First call - role1 succeeds, role2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only role2 is fetched (role1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called send 3 times total (role1 once, role2 twice)
	strictEqual(sendStub.callCount, 3);
});

test("It should export stsParam helper for TypeScript type inference", async (t) => {
	const { stsParam } = await import("./index.js");
	const paramName = "test-param";
	const result = stsParam(paramName);
	strictEqual(result, paramName);
});
