import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	strictEqual,
	throws,
} from "node:assert/strict";
import { test } from "node:test";
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
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

test("secretsManagerValidateOptions validates AwsClient as a constructor function", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({ AwsClient: SecretsManagerClient }),
	);
	throws(
		() => secretsManagerValidateOptions({ AwsClient: "not-a-function" }),
		(e) => e instanceof TypeError && e.message.includes("AwsClient"),
	);
});

test("secretsManagerValidateOptions validates awsClientOptions as an object", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({
			awsClientOptions: { region: "us-east-1" },
		}),
	);
	throws(
		() => secretsManagerValidateOptions({ awsClientOptions: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("awsClientOptions"),
	);
});

test("secretsManagerValidateOptions validates awsClientAssumeRole as a string", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({ awsClientAssumeRole: "arn:role" }),
	);
	throws(
		() => secretsManagerValidateOptions({ awsClientAssumeRole: 42 }),
		(e) => e instanceof TypeError && e.message.includes("awsClientAssumeRole"),
	);
});

test("secretsManagerValidateOptions validates awsClientCapture as a function", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({ awsClientCapture: () => {} }),
	);
	throws(
		() => secretsManagerValidateOptions({ awsClientCapture: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("awsClientCapture"),
	);
});

test("secretsManagerValidateOptions validates fetchData as an object of strings", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({ fetchData: { token: "api_key" } }),
	);
	throws(
		() => secretsManagerValidateOptions({ fetchData: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("fetchData"),
	);
	throws(
		() => secretsManagerValidateOptions({ fetchData: { token: 42 } }),
		(e) => e instanceof TypeError && e.message.includes("fetchData"),
	);
});

test("secretsManagerValidateOptions validates disablePrefetch as a boolean", () => {
	doesNotThrow(() => secretsManagerValidateOptions({ disablePrefetch: true }));
	throws(
		() => secretsManagerValidateOptions({ disablePrefetch: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("disablePrefetch"),
	);
});

test("secretsManagerValidateOptions validates cacheKey as a string", () => {
	doesNotThrow(() => secretsManagerValidateOptions({ cacheKey: "my-key" }));
	throws(
		() => secretsManagerValidateOptions({ cacheKey: 42 }),
		(e) => e instanceof TypeError && e.message.includes("cacheKey"),
	);
});

test("secretsManagerValidateOptions validates cacheKeyExpiry as an object of numbers >= -1", () => {
	doesNotThrow(() =>
		secretsManagerValidateOptions({ cacheKeyExpiry: { "my-key": -1 } }),
	);
	doesNotThrow(() =>
		secretsManagerValidateOptions({ cacheKeyExpiry: { "my-key": 0 } }),
	);
	throws(
		() => secretsManagerValidateOptions({ cacheKeyExpiry: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("cacheKeyExpiry"),
	);
	throws(
		() => secretsManagerValidateOptions({ cacheKeyExpiry: { "my-key": "x" } }),
		(e) => e instanceof TypeError && e.message.includes("cacheKeyExpiry"),
	);
	throws(
		() => secretsManagerValidateOptions({ cacheKeyExpiry: { "my-key": -2 } }),
		(e) => e instanceof TypeError && e.message.includes("cacheKeyExpiry"),
	);
});

test("secretsManagerValidateOptions validates cacheExpiry as a number >= -1", () => {
	doesNotThrow(() => secretsManagerValidateOptions({ cacheExpiry: -1 }));
	doesNotThrow(() => secretsManagerValidateOptions({ cacheExpiry: 1000 }));
	throws(
		() => secretsManagerValidateOptions({ cacheExpiry: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("cacheExpiry"),
	);
	throws(
		() => secretsManagerValidateOptions({ cacheExpiry: -2 }),
		(e) => e instanceof TypeError && e.message.includes("cacheExpiry"),
	);
});

test("secretsManagerValidateOptions validates setToContext as a boolean", () => {
	doesNotThrow(() => secretsManagerValidateOptions({ setToContext: true }));
	throws(
		() => secretsManagerValidateOptions({ setToContext: "nope" }),
		(e) => e instanceof TypeError && e.message.includes("setToContext"),
	);
});

test("It should cache forever by default (cacheExpiry default of -1)", async (t) => {
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
				// cacheExpiry intentionally omitted: default is -1 (cache forever).
				fetchData: {
					token: "api_key",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	// Advance time well past any finite default; with the -1 default the cached
	// value must still be served, so no further fetch is issued.
	t.mock.timers.tick(60 * 60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

test("It should honour a per-cacheKey expiry override from cacheKeyExpiry", async (t) => {
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
				cacheKey: "secrets-keyexpiry-cache",
				// Infinite default, but the per-key override disables caching for this
				// cacheKey, forcing a fresh fetch on every invocation.
				cacheExpiry: -1,
				cacheKeyExpiry: { "secrets-keyexpiry-cache": 0 },
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

test("It should not set secrets to context by default (setToContext default of false)", async (t) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key_no_context" })
		.resolvesOnce({ SecretString: "token" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.tokenNoContext, "token");
		// setToContext omitted: default false, so context must stay clean.
		strictEqual(request.context.tokenNoContext, undefined);
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheKey: "secrets-no-context-cache",
				cacheExpiry: 0,
				fetchData: {
					tokenNoContext: "api_key_no_context",
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should treat cacheExpiry:0 with rotation as an immediate (non-rotation-clamped) expiry", async (t) => {
	// cacheExpiry === 0 must take the `else` branch (lastChanged + 0), NOT the
	// `< 0` NextRotationDate branch. lastChanged is in the past, so the derived
	// expiry is already past and every invocation re-describes the secret.
	t.mock.timers.setTime(1_700_000_000_000);
	const changed = new Date(Date.now() - 50 * 1000);
	const nextRotation = new Date(Date.now() + 60 * 60 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_zero_expiry" })
		.resolves({
			LastRotationDate: changed,
			LastChangedDate: changed,
			NextRotationDate: nextRotation,
		})
		.on(GetSecretValueCommand, { SecretId: "api_key_zero_expiry" })
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
				cacheKey: "secrets-zero-expiry-cache",
				cacheExpiry: 0,
				fetchData: {
					token: "api_key_zero_expiry",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	// Past lastChanged expiry on every call (cacheExpiry:0 -> lastChanged+0).
	// If the `< 0` boundary were `<= 0`, expiry would clamp to the far-future
	// NextRotationDate and the second call would skip DescribeSecret.
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should not corrupt expiry when one rotation key lacks an expiry date", async (t) => {
	// First key yields a defined keyExpiry (NextRotationDate), second key yields
	// an undefined keyExpiry (cacheExpiry:-1 and no NextRotationDate). The guard
	// `if (keyExpiry !== undefined)` must skip the second; otherwise expiry
	// becomes Math.min(defined, undefined) === NaN and processCache rejects it.
	t.mock.timers.setTime(1_700_000_000_000);
	const nextRotation = new Date(Date.now() + 10 * 60 * 1000);
	mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "secret_with_rotation" })
		.resolves({ NextRotationDate: nextRotation })
		.on(DescribeSecretCommand, { SecretId: "secret_without_rotation" })
		.resolves({})
		.on(GetSecretValueCommand, { SecretId: "secret_with_rotation" })
		.resolves({ SecretString: "rotates" })
		.on(GetSecretValueCommand, { SecretId: "secret_without_rotation" })
		.resolves({ SecretString: "static" });
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.keyRotates, "rotates");
		strictEqual(values.keyStatic, "static");
	};

	handler
		.use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheKey: "secrets-mixed-rotation-cache",
				cacheExpiry: -1,
				fetchData: {
					keyRotates: "secret_with_rotation",
					keyStatic: "secret_without_rotation",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	// Must resolve cleanly; a NaN expiry would make processCache throw an
	// "Invalid cacheExpiry" TypeError instead.
	await handler(defaultEvent, defaultContext);
});

test("It should treat an exactly-current expiry as expired (strict greater-than)", async (t) => {
	// cacheUnexpired uses `cached.expiry > Date.now()`. When the stored rotation
	// expiry equals the current time exactly, the entry must be considered
	// expired and re-described. A `>=` boundary would wrongly keep it.
	t.mock.timers.setTime(1_700_000_000_000);
	const rotationDate = new Date(Date.now() + 30 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_exact_expiry" })
		.resolves({ NextRotationDate: rotationDate })
		.on(GetSecretValueCommand, { SecretId: "api_key_exact_expiry" })
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
				cacheKey: "secrets-exact-expiry-cache",
				cacheExpiry: -1,
				fetchData: {
					token: "api_key_exact_expiry",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 1);
	// Advance to EXACTLY the rotation expiry (now === cached.expiry).
	t.mock.timers.tick(30 * 1000);
	await handler(defaultEvent, defaultContext);
	strictEqual(mockService.commandCalls(DescribeSecretCommand).length, 2);
});

test("It should evict the stale cache entry before refreshing rotation expiry", async (t) => {
	// On rotation expiry the stale entry must be cleared so processCache
	// re-fetches GetSecretValue under the new expiry. If the entry were NOT
	// evicted, the newer (future) rotation override would mask the now-expired
	// cached value: processCache would see it as still-fresh and skip the fetch.
	t.mock.timers.setTime(1_700_000_000_000);
	const firstRotation = new Date(Date.now() + 30 * 1000);
	const secondRotation = new Date(Date.now() + 600 * 1000);
	const mockService = mockClient(SecretsManagerClient)
		.on(DescribeSecretCommand, { SecretId: "api_key_evict" })
		.resolvesOnce({ NextRotationDate: firstRotation })
		.resolves({ NextRotationDate: secondRotation })
		.on(GetSecretValueCommand, { SecretId: "api_key_evict" })
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
				cacheKey: "secrets-evict-cache",
				cacheExpiry: -1,
				fetchData: {
					token: "api_key_evict",
				},
				fetchRotationDate: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	// First rotation date (+30s) lapses; the scheduled refresh re-fetches once.
	// The second invocation (+60s) then finds the entry expired and, after
	// eviction, re-fetches a third time. Without eviction the value would be
	// masked by the new future override and only 2 fetches would occur.
	t.mock.timers.tick(60 * 1000);
	await handler(defaultEvent, defaultContext);

	strictEqual(mockService.commandCalls(GetSecretValueCommand).length, 3);
});

test("It should warm the cache during prefetch before the handler runs", async (t) => {
	// With prefetch enabled the factory eagerly runs processCache so the secret
	// is fetched before the first invocation. The GetSecretValue call must fire
	// at .use() time, not be deferred to the before hook.
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key_prefetch_warm" })
		.resolves({ SecretString: "token" });

	middy(() => {}).use(
		secretsManager({
			AwsClient: SecretsManagerClient,
			cacheKey: "secrets-prefetch-warm-cache",
			cacheExpiry: -1,
			fetchData: {
				token: "api_key_prefetch_warm",
			},
		}),
	);

	// Flush the prefetch microtask chain (fetchRotationDates -> processCache).
	await new Promise((resolve) => setImmediate(resolve));
	strictEqual(mockService.commandCalls(GetSecretValueCommand).length, 1);
});

test("It should reuse the prefetch client and not recreate it in the before hook", async (t) => {
	// canPrefetch is true here, so the client is created once during prefetch.
	// The before hook guard `if (!client)` must skip createClient; otherwise a
	// second client is constructed per invocation.
	let constructed = 0;
	class CountingClient extends SecretsManagerClient {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}
	mockClient(CountingClient)
		.on(GetSecretValueCommand, { SecretId: "api_key_reuse_client" })
		.resolves({ SecretString: "token" });

	const handler = middy(() => {}).use(
		secretsManager({
			AwsClient: CountingClient,
			cacheKey: "secrets-reuse-client-cache",
			cacheExpiry: -1,
			fetchData: {
				token: "api_key_reuse_client",
			},
		}),
	);

	await new Promise((resolve) => setImmediate(resolve));
	const afterPrefetch = constructed;
	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	// The prefetch builds the client; subsequent invocations must reuse it.
	strictEqual(constructed, afterPrefetch);
	strictEqual(afterPrefetch, 1);
});

test("It should accept fetchRotationDate explicitly set to undefined", async (t) => {
	// fetchRotationDate is optional; passing undefined must not throw. The
	// rotation checks use optional chaining, so undefined collapses to "no
	// rotation" rather than a property access on undefined.
	const mockService = mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand, { SecretId: "api_key_undef_rotation" })
		.resolves({ SecretString: "token" });

	let handler;
	doesNotThrow(() => {
		handler = middy(() => {}).use(
			secretsManager({
				AwsClient: SecretsManagerClient,
				cacheKey: "secrets-undef-rotation-cache",
				cacheExpiry: -1,
				fetchData: {
					token: "api_key_undef_rotation",
				},
				fetchRotationDate: undefined,
			}),
		);
	});

	// Prefetch path also iterates the keys with optional chaining; warming must
	// succeed without a throw.
	await new Promise((resolve) => setImmediate(resolve));
	strictEqual(mockService.commandCalls(GetSecretValueCommand).length, 1);

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.token, "token");
	};
	handler.before(middleware);
	await handler(defaultEvent, defaultContext);
});
