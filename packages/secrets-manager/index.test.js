import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import secretsManager from "./index.js";

test.beforeEach(async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
});
test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set secret to internal storage (token)", async (t) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolvesOnce({ SecretString: "token" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					token: "api_key",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set secrets to internal storage (token)", async (t) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key1" })
		.resolvesOnce({ SecretString: "token1" })
		.on(GetSecretValueCommand, { SecretId: "api_key2" })
		.resolvesOnce({ SecretString: "token2" });

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token1, "token1");
		strictEqual(values.token2, "token2");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					token1: "api_key1",
					token2: "api_key2",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set secrets to internal storage (json)", async (t) => {
	const credentials = { username: "admin", password: "secret" };
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "rds_login" })
		.resolvesOnce({ SecretString: JSON.stringify(credentials) });

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(
			{ username: "credentials.username", password: "credentials.password" },
			request,
		);
		deepStrictEqual(values, credentials);
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					credentials: "rds_login",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SecretsManager secret to internal storage without prefetch", async (t) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolvesOnce({ SecretString: "token" });

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					token: "api_key",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set SecretsManager secret to context", async (t) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolvesOnce({ SecretString: "token" });

	const handler = middy(() => {});

	const middleware = async (request) => {
		strictEqual(request.context.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					token: "api_key",
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolvesOnce({ SecretString: "token" });
	const sendStub = mockService.send;

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: -1,
				fetchData: {
					token: "api_key",
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolves({ SecretString: "token" });
	const sendStub = mockService.send;
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 0,
				fetchData: {
					token: "api_key",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate", async (t) => {
	const now = Date.now() / 1000;
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_LastRotationDate" })
		.resolves({
			LastRotationDate: now - 50,
			LastChangedDate: now - 50,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_LastRotationDate" })
		.resolves({ SecretString: "token" });
	const sendStub = mockService.send;
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 15 * 60 * 1000,
				fetchData: {
					token: "api_key_LastRotationDate",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2 * 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate, fallback to NextRotationDate", async (t) => {
	const now = Date.now() / 1000;
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, {
			SecretId: "api_key_LastRotationDate_NextRotationDate",
		})
		.resolves({
			LastRotationDate: now - 25,
			LastChangedDate: now - 25,
			NextRotationDate: now + 5 * 60,
		})
		.on(GetSecretValueCommand, {
			SecretId: "api_key_LastRotationDate_NextRotationDate",
		})
		.resolves({ SecretString: "token" });
	const sendStub = mockService.send;
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 15 * 60 * 1000,
				fetchData: {
					token: "api_key_LastRotationDate_NextRotationDate",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2 * 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using NextRotationDate", async (t) => {
	const now = Date.now() / 1000;
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_NextRotationDate" })
		.resolves({ NextRotationDate: now + 50 })
		.on(GetSecretValueCommand, { SecretId: "api_key_NextRotationDate" })
		.resolves({ SecretString: "token" });
	const sendStub = mockService.send;
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: -1,
				fetchData: {
					token: "api_key_NextRotationDate",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		secretsManager({
			AwsClient: SecretsManagerClient,
			cacheExpiry: 0,
			fetchData: {
				token: "api_key",
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

test("It should catch and modify cache if error is returned with caching enabled", async (t) => {
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		secretsManager({
			AwsClient: SecretsManagerClient,
			cacheKey: "secrets-test-cache",
			cacheExpiry: -1,
			fetchData: {
				token: "api_key",
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

test("It should handle InvalidSignatureException and retry", async (t) => {
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	const client = mockClient(SecretsManagerClient);
	client
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.rejectsOnce(invalidSignatureError)
		.resolves({ SecretString: "secret" });

	const handler = middy(() => {}).use(
		secretsManager({
			AwsClient: SecretsManagerClient,
			cacheExpiry: 0,
			fetchData: {
				token: "api_key",
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	await handler(event, context);
	strictEqual(client.send.callCount, 2);
});

test("It should handle InvalidSignatureException on DescribeSecretCommand and retry", async (t) => {
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	const client = mockClient(SecretsManagerClient);
	client
		.on(DescribeSecretCommand, { SecretId: "api_key" })
		.rejectsOnce(invalidSignatureError)
		.resolves({ NextRotationDate: Date.now() / 1000 + 60 * 60 * 24 })
		.on(GetSecretValueCommand, { SecretId: "api_key" })
		.resolves({ SecretString: "secret" });

	const handler = middy(() => {}).use(
		secretsManager({
			AwsClient: SecretsManagerClient,
			cacheExpiry: -1,
			fetchData: {
				token: "api_key",
			},
			fetchRotationDate: true,
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	await handler(event, context);
	strictEqual(client.send.callCount, 3); // 2 for DescribeSecret (fail + retry) + 1 for GetSecretValue
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand)
		.callsFake(async (input) => {
			callCount++;
			// First call for secret1 succeeds
			if (callCount === 1 && input.SecretId === "secret1") {
				return { SecretString: "value1" };
			}
			// Second call for secret2 fails
			if (callCount === 2 && input.SecretId === "secret2") {
				throw new Error("timeout");
			}
			// Third call only fetches secret2 (secret1 is cached)
			if (callCount === 3 && input.SecretId === "secret2") {
				return { SecretString: "value2" };
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1, "value1");
		strictEqual(values.key2, "value2");
	};

	const handler = middy(() => {})
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: 1000,
				fetchData: {
					key1: "secret1",
					key2: "secret2",
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

	// Should have called send 3 times total
	strictEqual(sendStub.callCount, 3);
});

test("It should export secretsManagerParam helper for TypeScript type inference", async (t) => {
	const { secretsManagerParam } = await import("./index.js");
	const secretName = "test-secret";
	const result = secretsManagerParam(secretName);
	strictEqual(result, secretName);
});
