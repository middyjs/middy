import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import sts, { stsValidateOptions } from "./index.js";

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

test("stsValidateOptions accepts valid options and rejects typos", () => {
	stsValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
	stsValidateOptions({});
	try {
		stsValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/sts");
	}
});

test("stsValidateOptions rejects wrong type", () => {
	try {
		stsValidateOptions({ setToContext: 1 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("setToContext"));
	}
});

test("It should prefetch credentials at init by default (no disablePrefetch)", async (t) => {
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
	handler.use(
		sts({
			AwsClient: STSClient,
			cacheKey: "sts-prefetch-default",
			fetchData: {
				role: {
					RoleArn: ".../role",
				},
			},
		}),
	);

	// Prefetch should have triggered a send before any invocation.
	strictEqual(sendStub.callCount, 1);

	await handler(defaultEvent, defaultContext);
	await new Promise((resolve) => setTimeout(resolve, 10));
	await handler(defaultEvent, defaultContext);

	// Default cacheExpiry is -1 (cache forever): the prefetched value is reused,
	// so no further sends happen even after a delay longer than a 1ms expiry.
	strictEqual(sendStub.callCount, 1);
});

test("It should reuse the prefetched client without recreating it", async (t) => {
	let constructed = 0;
	class CountingSTSClient extends STSClient {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}
	mockClient(CountingSTSClient)
		.on(AssumeRoleCommand)
		.resolves({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});

	const handler = middy(() => {});
	handler.use(
		sts({
			AwsClient: CountingSTSClient,
			cacheKey: "sts-prefetch-reuse",
			fetchData: {
				role: {
					RoleArn: ".../role",
				},
			},
		}),
	);

	// Prefetch constructs the client once at init.
	strictEqual(constructed, 1);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	// Client is reused, never reconstructed in the before hook.
	strictEqual(constructed, 1);
});

test("It should NOT set credentials to context by default", async (t) => {
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.resolves({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		});

	const handler = middy(() => {});
	const middleware = async (request) => {
		strictEqual(request.context.role, undefined);
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

	// Fresh context (defaultContext is shared and mutated by setToContext tests).
	await handler(defaultEvent, { getRemainingTimeInMillis: () => 1000 });
});

test("It should generate a default RoleSessionName when none provided", async (t) => {
	// Fix Math.random so the generated suffix is deterministic: with 0.5 the
	// real `Math.ceil(0.5 * 99999)` is 50000, whereas a `/` mutant would yield
	// `Math.ceil(0.5 / 99999)` === 1.
	t.mock.method(Math, "random", () => 0.5);

	let captured;
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.callsFake(async (input) => {
			captured = input;
			return {
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
				},
			};
		});

	const handler = middy(() => {}).use(
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
	);

	await handler(defaultEvent, defaultContext);

	strictEqual(captured.RoleSessionName, "middy-sts-session-50000");
});

test("It should preserve a provided RoleSessionName", async (t) => {
	let captured;
	mockClient(STSClient)
		.on(AssumeRoleCommand)
		.callsFake(async (input) => {
			captured = input;
			return {
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
				},
			};
		});

	const handler = middy(() => {}).use(
		sts({
			AwsClient: STSClient,
			cacheExpiry: 0,
			fetchData: {
				role: {
					RoleArn: ".../role",
					RoleSessionName: "my-session",
				},
			},
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);

	strictEqual(captured.RoleSessionName, "my-session");
});

const accepts = (options) => {
	stsValidateOptions(options);
};
const rejects = (options, messagePart) => {
	try {
		stsValidateOptions(options);
		ok(false, `expected throw for ${JSON.stringify(messagePart)}`);
	} catch (e) {
		ok(e instanceof TypeError, "expected TypeError");
		strictEqual(e.cause.package, "@middy/sts");
		ok(
			e.message.includes(messagePart),
			`expected message to include '${messagePart}', got: ${e.message}`,
		);
	}
};

test("stsValidateOptions validates AwsClient is a function", () => {
	accepts({ AwsClient: STSClient });
	rejects({ AwsClient: {} }, "AwsClient");
	rejects({ AwsClient: "STSClient" }, "AwsClient");
});

test("stsValidateOptions validates awsClientOptions is an object", () => {
	accepts({ awsClientOptions: { region: "us-east-1" } });
	rejects({ awsClientOptions: "us-east-1" }, "awsClientOptions");
	rejects({ awsClientOptions: 1 }, "awsClientOptions");
});

test("stsValidateOptions validates awsClientAssumeRole is a string", () => {
	accepts({ awsClientAssumeRole: "credentials" });
	rejects({ awsClientAssumeRole: 1 }, "awsClientAssumeRole");
	rejects({ awsClientAssumeRole: {} }, "awsClientAssumeRole");
});

test("stsValidateOptions validates awsClientCapture is a function", () => {
	accepts({ awsClientCapture: () => {} });
	rejects({ awsClientCapture: {} }, "awsClientCapture");
	rejects({ awsClientCapture: "capture" }, "awsClientCapture");
});

test("stsValidateOptions validates disablePrefetch is a boolean", () => {
	accepts({ disablePrefetch: true });
	rejects({ disablePrefetch: "true" }, "disablePrefetch");
	rejects({ disablePrefetch: 1 }, "disablePrefetch");
});

test("stsValidateOptions validates cacheKeyExpiry shape", () => {
	accepts({ cacheKeyExpiry: { role: 1000 } });
	accepts({ cacheKeyExpiry: { role: -1 } });
	rejects({ cacheKeyExpiry: "role" }, "cacheKeyExpiry");
	rejects({ cacheKeyExpiry: { role: "1000" } }, "cacheKeyExpiry.role");
	rejects({ cacheKeyExpiry: { role: -2 } }, "cacheKeyExpiry.role");
});

test("stsValidateOptions validates setToContext is a boolean", () => {
	accepts({ setToContext: true });
	rejects({ setToContext: "true" }, "setToContext");
});

test("stsValidateOptions validates fetchData is an object of role entries", () => {
	accepts({ fetchData: { role: { RoleArn: ".../role" } } });
	rejects({ fetchData: "role" }, "fetchData");
	rejects({ fetchData: { role: "string" } }, "fetchData.role");
});

test("stsValidateOptions requires RoleArn on each fetchData entry", () => {
	accepts({ fetchData: { role: { RoleArn: ".../role" } } });
	rejects({ fetchData: { role: {} } }, "RoleArn");
});

test("stsValidateOptions validates fetchData entry property types", () => {
	accepts({
		fetchData: {
			role: {
				RoleArn: ".../role",
				RoleSessionName: "session",
				DurationSeconds: 3600,
				ExternalId: "ext",
				Policy: "policy",
				SerialNumber: "serial",
				TokenCode: "token",
				TransitiveTagKeys: ["a", "b"],
			},
		},
	});
	rejects({ fetchData: { role: { RoleArn: 1 } } }, "fetchData.role.RoleArn");
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", RoleSessionName: 1 } } },
		"fetchData.role.RoleSessionName",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", DurationSeconds: "3600" } } },
		"fetchData.role.DurationSeconds",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", DurationSeconds: 800 } } },
		"fetchData.role.DurationSeconds",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", DurationSeconds: 50000 } } },
		"fetchData.role.DurationSeconds",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", ExternalId: 1 } } },
		"fetchData.role.ExternalId",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", Policy: 1 } } },
		"fetchData.role.Policy",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", SerialNumber: 1 } } },
		"fetchData.role.SerialNumber",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", TokenCode: 1 } } },
		"fetchData.role.TokenCode",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", TransitiveTagKeys: "a" } } },
		"fetchData.role.TransitiveTagKeys",
	);
	rejects(
		{ fetchData: { role: { RoleArn: ".../role", TransitiveTagKeys: [1] } } },
		"fetchData.role.TransitiveTagKeys[0]",
	);
});

test("stsValidateOptions allows extra passthrough properties on a role entry", () => {
	accepts({
		fetchData: { role: { RoleArn: ".../role", Tags: [{ Key: "k" }] } },
	});
});

test("It should throw a clear, package-tagged error for non-cloneable fetchData", () => {
	try {
		sts({
			fetchData: {
				role: {
					RoleArn: ".../role",
					bad: () => {},
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof DOMException), "should not be a raw DOMException");
		ok(e instanceof Error);
		ok(
			e.message.includes("fetchData"),
			`message should mention fetchData, got: ${e.message}`,
		);
		strictEqual(e.cause.package, "@middy/sts");
	}
});
