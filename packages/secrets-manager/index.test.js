import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import secretsManager, { secretsManagerValidateOptions } from "./index.js";

test.beforeEach(async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
});
test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const defaultEvent = {};
const defaultContext = {
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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
		deepStrictEqual(
			values,
			Object.create(null, Object.getOwnPropertyDescriptors(credentials)),
		);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_LastRotationDate" })
		.resolves({
			LastRotationDate: changed,
			LastChangedDate: changed,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_LastRotationDate" })
		.resolves({ SecretString: "token" });
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should swallow prefetch errors when rotation lookup fails", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_prefetch_fail" })
		.rejectsOnce(new Error("describe failed"))
		.resolves({ LastRotationDate: changed, LastChangedDate: changed })
		.on(GetSecretValueCommand, { SecretId: "api_key_prefetch_fail" })
		.resolves({ SecretString: "token" });
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
					token: "api_key_prefetch_fail",
				},
				fetchRotationDate: true,
			}),
		)
		.before(middleware);

	// Prefetch fires the (rejecting) DescribeSecret synchronously at .use(); its
	// rejection is swallowed by the prefetch .catch before the request runs.
	await handler(defaultEvent, defaultContext);
	ok(mockService.commandCalls(GetSecretValueCommand).length >= 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired using LastRotationDate, fallback to NextRotationDate", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 25 * 1000);
	const nextRotation = new Date(Date.now() + 5 * 60 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, {
			SecretId: "api_key_LastRotationDate_NextRotationDate",
		})
		.resolves({
			LastRotationDate: changed,
			LastChangedDate: changed,
			NextRotationDate: nextRotation,
		})
		.on(GetSecretValueCommand, {
			SecretId: "api_key_LastRotationDate_NextRotationDate",
		})
		.resolves({ SecretString: "token" });
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using LastChangedDate when LastRotationDate is undefined", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 50 * 1000);
	const nextRotation = new Date(Date.now() + 50 * 60 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_NoLastRotation" })
		.resolves({
			LastChangedDate: changed,
			NextRotationDate: nextRotation,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_NoLastRotation" })
		.resolves({ SecretString: "token" });
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
					token: "api_key_NoLastRotation",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should call aws-sdk if cache enabled using LastRotationDate when LastChangedDate is undefined", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const rotated = new Date(Date.now() - 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_NoLastChanged" })
		.resolves({
			LastRotationDate: rotated,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_NoLastChanged" })
		.resolves({ SecretString: "token" });
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
					token: "api_key_NoLastChanged",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired using NextRotationDate", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const nextRotation = new Date(Date.now() + 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_NextRotationDate" })
		.resolves({ NextRotationDate: nextRotation })
		.on(GetSecretValueCommand, { SecretId: "api_key_NextRotationDate" })
		.resolves({ SecretString: "token" });
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	// Cached until the rotation date even though cacheExpiry is -1 (infinite).
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should use default cacheExpiry when NextRotationDate is undefined", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_NoRotation" })
		.resolves({ LastChangedDate: changed })
		.on(GetSecretValueCommand, { SecretId: "api_key_NoRotation" })
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
					token: "api_key_NoRotation",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	t.mock.timers.tick(15 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	// Should cache indefinitely: only 1 Describe + 1 GetSecretValue
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
		await handler(defaultEvent, defaultContext);
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
		await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
	strictEqual(client.send.callCount, 2);
});

test("It should handle InvalidSignatureException on DescribeSecretCommand and retry", async (t) => {
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	const client = mockClient(SecretsManagerClient);
	client
		.on(DescribeSecretCommand, { SecretId: "api_key" })
		.rejectsOnce(invalidSignatureError)
		.resolves({ NextRotationDate: new Date(Date.now() + 60 * 60 * 24 * 1000) })
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

	await handler(defaultEvent, defaultContext);
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
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only key2 is fetched (key1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called send 3 times total
	strictEqual(sendStub.callCount, 3);
});

test("It should expire cache at NextRotationDate independent of cacheExpiry:-1", async (t) => {
	// Use a realistic epoch so the rotation timestamp is treated as an absolute
	// expiry (a small value < 24h in ms would be misread as a duration).
	t.mock.timers.setTime(1_700_000_000_000);
	const rotationDate = new Date(Date.now() + 50 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_RotationExpiry" })
		.resolves({ NextRotationDate: rotationDate })
		.on(GetSecretValueCommand, { SecretId: "api_key_RotationExpiry" })
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
					token: "api_key_RotationExpiry",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	// Before the rotation date the value is cached, so only a single
	// DescribeSecret was needed across the repeat invocations.
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	strictEqual(sendStub.callCount, 2);
	// Once the NextRotationDate passes the cache must expire even though
	// cacheExpiry is -1 (infinite), triggering a fresh DescribeSecret to learn
	// the new rotation date plus a fresh GetSecretValue.
	t.mock.timers.tick(60 * 1000);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should treat rotation date fields as millisecond Date values", async (t) => {
	// AWS SDK v3 returns these fields as Date objects. The expiry must be derived
	// from their millisecond value, not multiplied by 1000 (which would push the
	// expiry ~1000x into the future and defeat rotation-based invalidation).
	t.mock.timers.setTime(1_700_000_000_000);
	const lastChanged = new Date(Date.now() - 60 * 1000);
	const nextRotation = new Date(Date.now() + 30 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_DateFields" })
		.resolves({
			LastRotationDate: lastChanged,
			LastChangedDate: lastChanged,
			NextRotationDate: nextRotation,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_DateFields" })
		.resolves({ SecretString: "token" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				// 1h duration; the sooner NextRotationDate (+30s) must clamp expiry.
				cacheExpiry: 60 * 60 * 1000,
				fetchData: {
					token: "api_key_DateFields",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	// Advance past NextRotationDate (+30s) but well within cacheExpiry (1h). The
	// cache must expire at the rotation date, forcing a fresh DescribeSecret.
	t.mock.timers.tick(45 * 1000);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should expire the shared cache at the soonest rotation date across keys", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const soonRotation = new Date(Date.now() + 40 * 1000);
	const lateRotation = new Date(Date.now() + 10 * 60 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "secret_soon" })
		.resolves({ NextRotationDate: soonRotation })
		.on(DescribeSecretCommand, { SecretId: "secret_late" })
		.resolves({ NextRotationDate: lateRotation })
		.on(GetSecretValueCommand, { SecretId: "secret_soon" })
		.resolves({ SecretString: "soon" })
		.on(GetSecretValueCommand, { SecretId: "secret_late" })
		.resolves({ SecretString: "late" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.keySoon, "soon");
		strictEqual(values.keyLate, "late");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: -1,
				fetchData: {
					keySoon: "secret_soon",
					keyLate: "secret_late",
				},
				// Object form exercises per-key rotation selection.
				fetchRotationDate: { keySoon: true, keyLate: true },
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	// Two Describe calls (one per key) on the first, uncached invocation.
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
	// Past the soonest rotation date (+40s) but before the later one (+10m): the
	// shared cache entry must expire and trigger fresh DescribeSecret calls.
	t.mock.timers.tick(60 * 1000);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 4);
});

test("It should not fetch rotation date for keys without rotation enabled", async (t) => {
	t.mock.timers.setTime(1_700_000_000_000);
	const soonRotation = new Date(Date.now() + 40 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "secret_rotated" })
		.resolves({ NextRotationDate: soonRotation })
		.on(GetSecretValueCommand, { SecretId: "secret_rotated" })
		.resolves({ SecretString: "rotated" })
		.on(GetSecretValueCommand, { SecretId: "secret_plain" })
		.resolves({ SecretString: "plain" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.keyRotated, "rotated");
		strictEqual(values.keyPlain, "plain");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheExpiry: -1,
				fetchData: {
					keyRotated: "secret_rotated",
					keyPlain: "secret_plain",
				},
				// Only one key opts into rotation; the other must be skipped.
				fetchRotationDate: { keyRotated: true },
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	// DescribeSecret only for the rotation-enabled key.
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	strictEqual(
		mockService.commandCalls(DescribeSecretCommand, {
			SecretId: "secret_plain",
		}).length,
		0,
	);
});

test("It should export secretsManagerParam helper for TypeScript type inference", async (t) => {
	const { secretsManagerParam } = await import("./index.js");
	const secretName = "test-secret";
	const result = secretsManagerParam(secretName);
	strictEqual(result, secretName);
});

test("secretsManagerValidateOptions accepts valid options and rejects typos", () => {
	secretsManagerValidateOptions({ cacheKey: "x", fetchRotationDate: true });
	secretsManagerValidateOptions({ fetchRotationDate: { key: true } });
	secretsManagerValidateOptions({});
	try {
		secretsManagerValidateOptions({ fetchRotationData: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("fetchRotationData"));
		strictEqual(e.cause.package, "@middy/secrets-manager");
	}
});

test("secretsManagerValidateOptions rejects invalid fetchRotationDate type", () => {
	try {
		secretsManagerValidateOptions({ fetchRotationDate: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fetchRotationDate"));
	}
});

test("secretsManagerValidateOptions rejects non-boolean values in fetchRotationDate object", () => {
	try {
		secretsManagerValidateOptions({ fetchRotationDate: { key: "yes" } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fetchRotationDate"));
	}
});
