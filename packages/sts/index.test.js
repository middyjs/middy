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

const event = {};
const context = {
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

	await handler(event, context);
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

	await handler(event, context);
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

	await handler(event, context);
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

	await handler(event, context);
	await handler(event, context);

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

	await handler(event, context);
	await handler(event, context);

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
		await handler(event, context);
	} catch (e) {
		strictEqual(sendStub.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});
