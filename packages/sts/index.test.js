import {
	rejects as assertRejects,
	deepStrictEqual,
	match,
	ok,
	strictEqual,
} from "node:assert/strict";
import { describe, test } from "node:test";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import sts, { stsValidateOptions } from "./index.js";

describe("@middy/sts", () => {
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
			deepStrictEqual(
				{ ...request.context.middyContext.sts.role },
				{
					accessKeyId: "accessKeyId",
					secretAccessKey: "secretAccessKey",
					sessionToken: "sessionToken",
				},
			);
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

	test("It should expire cached credentials 60 s before the AssumeRole Expiration", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const mockService = mockClient(STSClient)
			.on(AssumeRoleCommand)
			.resolves({
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
					Expiration: new Date(Date.now() + 60 * 60 * 1000),
				},
			});
		const sendStub = mockService.send;

		const handler = middy(() => {}).use(
			sts({
				AwsClient: STSClient,
				cacheKey: "sts-expiration-clamp",
				cacheExpiry: -1,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		// 58 min later the credentials are still inside the 60 s margin, so the
		// cache is served.
		t.mock.timers.tick(58 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 1);
		// 61 min later the credentials have expired, so AssumeRole runs again even
		// though cacheExpiry is -1.
		t.mock.timers.tick(3 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 2);
	});

	test("It should keep a shorter cacheExpiry over a later AssumeRole Expiration", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const mockService = mockClient(STSClient)
			.on(AssumeRoleCommand)
			.resolves({
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
					Expiration: new Date(Date.now() + 60 * 60 * 1000),
				},
			});
		const sendStub = mockService.send;

		const handler = middy(() => {}).use(
			sts({
				AwsClient: STSClient,
				cacheKey: "sts-expiration-shorter-cacheExpiry",
				cacheExpiry: 10 * 60 * 1000,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		t.mock.timers.tick(9 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 1);
		// The configured 10 min wins over the 1 h credential lifetime.
		t.mock.timers.tick(2 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 2);
	});

	test("It should retry client creation on the next invocation after a rejected init", async (t) => {
		let constructed = 0;
		class FlakyClient extends STSClient {
			constructor(...args) {
				constructed++;
				if (constructed === 1) throw new Error("init failed");
				super(...args);
			}
		}
		mockClient(FlakyClient)
			.on(AssumeRoleCommand)
			.resolves({
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
				},
			});

		const handler = middy(() => {}).use(
			sts({
				AwsClient: FlakyClient,
				cacheKey: "sts-client-init-retry",
				cacheExpiry: 0,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await assertRejects(handler(defaultEvent, defaultContext), /init failed/);
		await handler(defaultEvent, defaultContext);
		strictEqual(constructed, 2);
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
			deepStrictEqual(e.errors, [new Error("timeout")]);
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
			strictEqual(request.context.middyContext.sts, undefined);
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

		match(
			captured.RoleSessionName,
			/^@middy-sts-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	test("It should share a cacheKey between instances with identical fetchData and a default RoleSessionName", async (t) => {
		const send = t.mock.fn(async () => ({
			Credentials: {
				AccessKeyId: "accessKeyId",
				SecretAccessKey: "secretAccessKey",
				SessionToken: "sessionToken",
			},
		}));
		mockClient(STSClient).on(AssumeRoleCommand).callsFake(send);
		const handlerFor = () =>
			middy(() => {}).use(
				sts({
					AwsClient: STSClient,
					cacheExpiry: -1,
					fetchData: { role: { RoleArn: ".../role" } },
					disablePrefetch: true,
				}),
			);

		await handlerFor()(defaultEvent, defaultContext);
		await handlerFor()(defaultEvent, defaultContext);
		strictEqual(send.mock.callCount(), 1);
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

	const roleArn = "arn:aws:iam::123456789012:role/demo";
	const role = (entry) => ({
		fetchData: { role: { RoleArn: roleArn, ...entry } },
	});

	test("stsValidateOptions validates fetchData is an object of role entries", () => {
		accepts({ fetchData: { role: { RoleArn: roleArn } } });
		rejects({ fetchData: "role" }, "fetchData");
		rejects({ fetchData: { role: "string" } }, "fetchData.role");
	});

	test("stsValidateOptions requires RoleArn on each fetchData entry", () => {
		rejects({ fetchData: { role: {} } }, "RoleArn");
	});

	test("stsValidateOptions bounds the fetchData internal keys", () => {
		accepts({ fetchData: { "@middy/db.password!": { RoleArn: roleArn } } });
		accepts({
			fetchData: Object.fromEntries(
				Array.from({ length: 1024 }, (_, i) => [`k${i}`, { RoleArn: roleArn }]),
			),
		});
		rejects(
			{
				fetchData: Object.fromEntries(
					Array.from({ length: 1025 }, (_, i) => [
						`k${i}`,
						{ RoleArn: roleArn },
					]),
				),
			},
			"fetchData",
		);
		rejects({ fetchData: { "a b": { RoleArn: roleArn } } }, "a b");
		accepts({ fetchData: { ["k".repeat(1024)]: { RoleArn: roleArn } } });
		rejects({ fetchData: { ["k".repeat(1025)]: { RoleArn: roleArn } } }, "kkk");
	});

	test("stsValidateOptions accepts every AssumeRole request parameter", () => {
		// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
		accepts(
			role({
				RoleSessionName: "testAR",
				PolicyArns: [
					{ arn: "arn:aws:iam::123456789012:policy/demopolicy1" },
					{ arn: "arn:aws:iam::aws:policy/ReadOnlyAccess" },
					{},
				],
				Policy: '{\n\t"Version": "2012-10-17",\r\n\t"Statement": []\n}',
				DurationSeconds: 3600,
				Tags: [
					{ Key: "Project", Value: "Pegasus" },
					{ Key: "Cost Center", Value: "" },
				],
				TransitiveTagKeys: ["Project", "Cost Center"],
				ExternalId: "123ABC",
				SerialNumber: "arn:aws:iam::123456789012:mfa/user",
				TokenCode: "123456",
				SourceIdentity: "Alice",
				ProvidedContexts: [
					{
						ProviderArn: "arn:aws:iam::aws:contextProvider/IdentityCenter",
						ContextAssertion: "trusted-context-assertion",
					},
					{},
				],
				MinimumSessionTokenSize: 0,
			}),
		);
	});

	test("stsValidateOptions rejects keys AssumeRole does not take", () => {
		rejects(role({ RoleARN: roleArn }), "fetchData.role.RoleARN");
		rejects(
			role({ PolicyArns: [{ arn: roleArn, Arn: roleArn }] }),
			"fetchData.role.PolicyArns[0].Arn",
		);
		rejects(
			role({ Tags: [{ Key: "k", Value: "v", Extra: "x" }] }),
			"fetchData.role.Tags[0].Extra",
		);
		rejects(
			role({ ProvidedContexts: [{ Extra: "x" }] }),
			"fetchData.role.ProvidedContexts[0].Extra",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to RoleArn", () => {
		rejects({ fetchData: { role: { RoleArn: 1 } } }, "fetchData.role.RoleArn");
		rejects(role({ RoleArn: ".../role" }), "fetchData.role.RoleArn");
		rejects(
			role({ RoleArn: "iam::123456789012:role/demo" }),
			"fetchData.role.RoleArn",
		);
		rejects(role({ RoleArn: "arn:aws:iam::1:r/" }), "fetchData.role.RoleArn");
		rejects(role({ RoleArn: `x${roleArn}` }), "fetchData.role.RoleArn");
		rejects(role({ RoleArn: `${roleArn} x` }), "fetchData.role.RoleArn");
		accepts(role({ RoleArn: "arn:aws:iam::1:role/r" }));
		accepts(role({ RoleArn: "arn:aws-cn:iam::123456789012:role/demo" }));
		// ARN syntax: arn:partition:service:region:account-id:resource
		accepts(role({ RoleArn: "arn:aws:iam:us-east-1:123456789012:role/demo" }));
		accepts(role({ RoleArn: `arn:aws:iam::1:role/${"r".repeat(2028)}` }));
		rejects(
			role({ RoleArn: `arn:aws:iam::1:role/${"r".repeat(2029)}` }),
			"fetchData.role.RoleArn",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to RoleSessionName", () => {
		rejects(role({ RoleSessionName: 1 }), "fetchData.role.RoleSessionName");
		rejects(role({ RoleSessionName: "" }), "fetchData.role.RoleSessionName");
		rejects(role({ RoleSessionName: "a" }), "fetchData.role.RoleSessionName");
		accepts(role({ RoleSessionName: "a_+=,.@-" }));
		accepts(role({ RoleSessionName: "s".repeat(64) }));
		rejects(
			role({ RoleSessionName: "s".repeat(65) }),
			"fetchData.role.RoleSessionName",
		);
		rejects(role({ RoleSessionName: "a b" }), "fetchData.role.RoleSessionName");
	});

	test("stsValidateOptions applies the AssumeRole limits to PolicyArns", () => {
		rejects(role({ PolicyArns: "arn" }), "fetchData.role.PolicyArns");
		rejects(role({ PolicyArns: ["arn"] }), "fetchData.role.PolicyArns[0]");
		const arns = Array.from({ length: 11 }, (_, i) => ({
			arn: `arn:aws:iam::123456789012:policy/p${i}`,
		}));
		accepts(role({ PolicyArns: arns.slice(0, 10) }));
		rejects(role({ PolicyArns: arns }), "fetchData.role.PolicyArns");
		rejects(
			role({ PolicyArns: [arns[0], arns[0]] }),
			"fetchData.role.PolicyArns[1]",
		);
		rejects(
			role({ PolicyArns: [{ arn: "iam::123456789012:policy/p" }] }),
			"fetchData.role.PolicyArns[0].arn",
		);
		rejects(
			role({ PolicyArns: [{ arn: "arn:aws:iam::1:p/" }] }),
			"fetchData.role.PolicyArns[0].arn",
		);
		rejects(
			role({
				PolicyArns: [{ arn: `arn:aws:iam::1:policy/${"p".repeat(2027)}` }],
			}),
			"fetchData.role.PolicyArns[0].arn",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to Policy", () => {
		rejects(role({ Policy: 1 }), "fetchData.role.Policy");
		rejects(role({ Policy: "" }), "fetchData.role.Policy");
		accepts(role({ Policy: "ÿ".repeat(2048) }));
		rejects(role({ Policy: "{".repeat(2049) }), "fetchData.role.Policy");
		rejects(role({ Policy: "Ā" }), "fetchData.role.Policy");
		rejects(role({ Policy: "Ā{}" }), "fetchData.role.Policy");
		rejects(role({ Policy: "{}Ā" }), "fetchData.role.Policy");
		rejects(role({ Policy: "\u0000" }), "fetchData.role.Policy");
	});

	test("stsValidateOptions applies the AssumeRole limits to DurationSeconds", () => {
		rejects(
			role({ DurationSeconds: "3600" }),
			"fetchData.role.DurationSeconds",
		);
		rejects(
			role({ DurationSeconds: 3600.5 }),
			"fetchData.role.DurationSeconds",
		);
		accepts(role({ DurationSeconds: 900 }));
		rejects(role({ DurationSeconds: 899 }), "fetchData.role.DurationSeconds");
		accepts(role({ DurationSeconds: 43200 }));
		rejects(role({ DurationSeconds: 43201 }), "fetchData.role.DurationSeconds");
	});

	test("stsValidateOptions applies the AssumeRole limits to Tags", () => {
		rejects(role({ Tags: {} }), "fetchData.role.Tags");
		rejects(role({ Tags: ["k"] }), "fetchData.role.Tags[0]");
		rejects(role({ Tags: [{ Key: "k" }] }), "fetchData.role.Tags[0].Value");
		rejects(role({ Tags: [{ Value: "v" }] }), "fetchData.role.Tags[0].Key");
		const tags = Array.from({ length: 51 }, (_, i) => ({
			Key: `k${i}`,
			Value: "v",
		}));
		accepts(role({ Tags: tags.slice(0, 50) }));
		rejects(role({ Tags: tags }), "fetchData.role.Tags");
		rejects(role({ Tags: [tags[0], tags[0]] }), "fetchData.role.Tags[1]");
		accepts(role({ Tags: [{ Key: "k".repeat(128), Value: "v".repeat(256) }] }));
		rejects(
			role({ Tags: [{ Key: "k".repeat(129), Value: "v" }] }),
			"fetchData.role.Tags[0].Key",
		);
		rejects(
			role({ Tags: [{ Key: "", Value: "v" }] }),
			"fetchData.role.Tags[0].Key",
		);
		rejects(
			role({ Tags: [{ Key: "k", Value: "v".repeat(257) }] }),
			"fetchData.role.Tags[0].Value",
		);
		accepts(
			role({ Tags: [{ Key: "Über_.:/=+-@1", Value: "Ünïcode 9 _.:/=+-@" }] }),
		);
		rejects(
			role({ Tags: [{ Key: "k#", Value: "v" }] }),
			"fetchData.role.Tags[0].Key",
		);
		rejects(
			role({ Tags: [{ Key: "#k", Value: "v" }] }),
			"fetchData.role.Tags[0].Key",
		);
		rejects(
			role({ Tags: [{ Key: "k", Value: "v#" }] }),
			"fetchData.role.Tags[0].Value",
		);
		rejects(
			role({ Tags: [{ Key: 1, Value: "v" }] }),
			"fetchData.role.Tags[0].Key",
		);
		rejects(
			role({ Tags: [{ Key: "k", Value: 1 }] }),
			"fetchData.role.Tags[0].Value",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to TransitiveTagKeys", () => {
		rejects(
			role({ TransitiveTagKeys: "a" }),
			"fetchData.role.TransitiveTagKeys",
		);
		rejects(
			role({ TransitiveTagKeys: [1] }),
			"fetchData.role.TransitiveTagKeys[0]",
		);
		const keys = Array.from({ length: 51 }, (_, i) => `k${i}`);
		accepts(role({ TransitiveTagKeys: keys.slice(0, 50) }));
		rejects(
			role({ TransitiveTagKeys: keys }),
			"fetchData.role.TransitiveTagKeys",
		);
		rejects(
			role({ TransitiveTagKeys: ["a", "a"] }),
			"fetchData.role.TransitiveTagKeys[1]",
		);
		accepts(role({ TransitiveTagKeys: ["k".repeat(128)] }));
		rejects(
			role({ TransitiveTagKeys: ["k".repeat(129)] }),
			"fetchData.role.TransitiveTagKeys[0]",
		);
		rejects(
			role({ TransitiveTagKeys: [""] }),
			"fetchData.role.TransitiveTagKeys[0]",
		);
		rejects(
			role({ TransitiveTagKeys: ["k#"] }),
			"fetchData.role.TransitiveTagKeys[0]",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to ExternalId", () => {
		rejects(role({ ExternalId: 1 }), "fetchData.role.ExternalId");
		rejects(role({ ExternalId: "a" }), "fetchData.role.ExternalId");
		accepts(role({ ExternalId: "a_+=,.@:/-" }));
		accepts(role({ ExternalId: "e".repeat(1224) }));
		rejects(
			role({ ExternalId: "e".repeat(1225) }),
			"fetchData.role.ExternalId",
		);
		rejects(role({ ExternalId: "a b" }), "fetchData.role.ExternalId");
	});

	test("stsValidateOptions applies the AssumeRole limits to SerialNumber", () => {
		rejects(role({ SerialNumber: 1 }), "fetchData.role.SerialNumber");
		rejects(role({ SerialNumber: "12345678" }), "fetchData.role.SerialNumber");
		accepts(role({ SerialNumber: "GAHT12345678" }));
		accepts(role({ SerialNumber: "s".repeat(256) }));
		rejects(
			role({ SerialNumber: "s".repeat(257) }),
			"fetchData.role.SerialNumber",
		);
		rejects(
			role({ SerialNumber: "GAHT 12345678" }),
			"fetchData.role.SerialNumber",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to TokenCode", () => {
		rejects(role({ TokenCode: 123456 }), "fetchData.role.TokenCode");
		rejects(role({ TokenCode: "token" }), "fetchData.role.TokenCode");
		rejects(role({ TokenCode: "12345" }), "fetchData.role.TokenCode");
		rejects(role({ TokenCode: "1234567" }), "fetchData.role.TokenCode");
		rejects(role({ TokenCode: "12345a" }), "fetchData.role.TokenCode");
		rejects(role({ TokenCode: "a12345" }), "fetchData.role.TokenCode");
	});

	test("stsValidateOptions applies the AssumeRole limits to SourceIdentity", () => {
		rejects(role({ SourceIdentity: 1 }), "fetchData.role.SourceIdentity");
		rejects(role({ SourceIdentity: "a" }), "fetchData.role.SourceIdentity");
		accepts(role({ SourceIdentity: "s".repeat(64) }));
		rejects(
			role({ SourceIdentity: "s".repeat(65) }),
			"fetchData.role.SourceIdentity",
		);
		rejects(
			role({ SourceIdentity: "aws:me" }),
			"fetchData.role.SourceIdentity",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to ProvidedContexts", () => {
		const context = {
			ProviderArn: "arn:aws:iam::aws:contextProvider/IdentityCenter",
			ContextAssertion: "trusted-context-assertion",
		};
		rejects(
			role({ ProvidedContexts: context }),
			"fetchData.role.ProvidedContexts",
		);
		rejects(role({ ProvidedContexts: [] }), "fetchData.role.ProvidedContexts");
		rejects(
			role({ ProvidedContexts: ["c"] }),
			"fetchData.role.ProvidedContexts[0]",
		);
		const contexts = Array.from({ length: 6 }, (_, i) => ({
			...context,
			ContextAssertion: `assertion${i}`,
		}));
		accepts(role({ ProvidedContexts: contexts.slice(0, 5) }));
		rejects(
			role({ ProvidedContexts: contexts }),
			"fetchData.role.ProvidedContexts",
		);
		rejects(
			role({ ProvidedContexts: [context, context] }),
			"fetchData.role.ProvidedContexts[1]",
		);
		rejects(
			role({
				ProvidedContexts: [
					{ ProviderArn: "iam::aws:contextProvider/IdentityCenter" },
				],
			}),
			"fetchData.role.ProvidedContexts[0].ProviderArn",
		);
		rejects(
			role({ ProvidedContexts: [{ ProviderArn: "arn:aws:iam::aws:c/" }] }),
			"fetchData.role.ProvidedContexts[0].ProviderArn",
		);
		rejects(
			role({
				ProvidedContexts: [
					{ ProviderArn: `arn:aws:iam::aws:c/${"c".repeat(2030)}` },
				],
			}),
			"fetchData.role.ProvidedContexts[0].ProviderArn",
		);
		accepts(
			role({ ProvidedContexts: [{ ContextAssertion: "a".repeat(2048) }] }),
		);
		rejects(
			role({ ProvidedContexts: [{ ContextAssertion: "a".repeat(2049) }] }),
			"fetchData.role.ProvidedContexts[0].ContextAssertion",
		);
		rejects(
			role({ ProvidedContexts: [{ ContextAssertion: "abc" }] }),
			"fetchData.role.ProvidedContexts[0].ContextAssertion",
		);
		rejects(
			role({ ProvidedContexts: [{ ContextAssertion: "abc d" }] }),
			"fetchData.role.ProvidedContexts[0].ContextAssertion",
		);
	});

	test("stsValidateOptions applies the AssumeRole limits to MinimumSessionTokenSize", () => {
		rejects(
			role({ MinimumSessionTokenSize: "0" }),
			"fetchData.role.MinimumSessionTokenSize",
		);
		rejects(
			role({ MinimumSessionTokenSize: -1 }),
			"fetchData.role.MinimumSessionTokenSize",
		);
		accepts(role({ MinimumSessionTokenSize: 4096 }));
		rejects(
			role({ MinimumSessionTokenSize: 4097 }),
			"fetchData.role.MinimumSessionTokenSize",
		);
		rejects(
			role({ MinimumSessionTokenSize: 1.5 }),
			"fetchData.role.MinimumSessionTokenSize",
		);
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

	test("stsValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		stsValidateOptions({ contextKey: "custom" });
		try {
			stsValidateOptions({ contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should honour an Expiration returned as an ISO string", async (t) => {
		// A custom AwsClient can hand back the timestamp as a string rather than
		// the Date the SDK unmarshals; it must still clamp the cache instead of
		// dissolving into NaN and caching the credentials forever.
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const mockService = mockClient(STSClient)
			.on(AssumeRoleCommand)
			.resolves({
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
					Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
				},
			});
		const sendStub = mockService.send;

		const handler = middy(() => {}).use(
			sts({
				AwsClient: STSClient,
				cacheKey: "sts-expiration-iso",
				cacheExpiry: -1,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		t.mock.timers.tick(58 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 1);
		t.mock.timers.tick(3 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 2);
	});

	test("It should honour a per-cacheKey expiry override from cacheKeyExpiry", async (t) => {
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

		const handler = middy(() => {}).use(
			sts({
				AwsClient: STSClient,
				cacheKey: "sts-keyexpiry-cache",
				// Infinite default, but the per-key override disables caching for this
				// cacheKey, forcing a fresh AssumeRole on every invocation.
				cacheExpiry: -1,
				cacheKeyExpiry: { "sts-keyexpiry-cache": 0 },
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		strictEqual(sendStub.callCount, 2);
	});

	test("It should refetch inside the 60 s margin before the AssumeRole Expiration", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const mockService = mockClient(STSClient)
			.on(AssumeRoleCommand)
			.resolves({
				Credentials: {
					AccessKeyId: "accessKeyId",
					SecretAccessKey: "secretAccessKey",
					SessionToken: "sessionToken",
					Expiration: new Date(Date.now() + 60 * 60 * 1000),
				},
			});
		const sendStub = mockService.send;

		const handler = middy(() => {}).use(
			sts({
				AwsClient: STSClient,
				cacheKey: "sts-expiration-margin",
				cacheExpiry: -1,
				fetchData: {
					role: {
						RoleArn: ".../role",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		t.mock.timers.tick(58 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 1);
		// 59 min 30 s after issue the credentials are still valid for 30 s, but
		// that is inside the 60 s margin, so AssumeRole runs again rather than
		// handing out credentials about to expire.
		t.mock.timers.tick(90 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(sendStub.callCount, 2);
	});

	test("It should rebuild the client when the assumed-role credentials are refetched", async (t) => {
		const constructions = [];
		class FakeClient {
			constructor(awsClientOptions) {
				constructions.push(awsClientOptions);
			}
			send() {
				return Promise.resolve({
					Credentials: {
						AccessKeyId: "id",
						SecretAccessKey: "secret",
						SessionToken: "token",
					},
				});
			}
		}
		let credentials = Promise.resolve({ accessKeyId: "a" });
		const handler = middy(() => {})
			.before((request) => {
				request.internal.role = credentials;
			})
			.use(
				sts({
					AwsClient: FakeClient,
					awsClientAssumeRole: "role",
					cacheExpiry: 0,
					fetchData: { key: { RoleArn: "arn:aws:iam::0:role/r" } },
				}),
			);

		await handler(defaultEvent, defaultContext);
		// A later invocation carrying the same cached credential promise keeps
		// the client.
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 1);
		deepStrictEqual(constructions[0].credentials, { accessKeyId: "a" });

		// sts refetched: request.internal now holds a new promise object, so the
		// client is rebuilt with the new session instead of keeping the expired one.
		credentials = Promise.resolve({ accessKeyId: "b" });
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 2);
		deepStrictEqual(constructions[1].credentials, { accessKeyId: "b" });
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 2);
	});

	test("It should construct the client once without awsClientAssumeRole", async (t) => {
		let constructed = 0;
		class FakeClient {
			constructor() {
				constructed += 1;
			}
			send() {
				return Promise.resolve({
					Credentials: {
						AccessKeyId: "id",
						SecretAccessKey: "secret",
						SessionToken: "token",
					},
				});
			}
		}
		const handler = middy(() => {}).use(
			sts({
				AwsClient: FakeClient,
				disablePrefetch: true,
				cacheExpiry: 0,
				fetchData: { key: { RoleArn: "arn:aws:iam::0:role/r" } },
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		strictEqual(constructed, 1);
	});

	test("stsValidateOptions accepts cacheMaxSize and rejects values below 1", () => {
		stsValidateOptions({ cacheMaxSize: 10 });
		try {
			stsValidateOptions({ cacheMaxSize: 0 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("cacheMaxSize"));
		}
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
				return Promise.resolve({
					Credentials: {
						AccessKeyId: "id",
						SecretAccessKey: "secret",
						SessionToken: "token",
					},
				});
			}
		}
		const handler = middy(() => {})
			.before((request) => {
				request.internal.role = Promise.resolve({ accessKeyId: "a" });
			})
			.use(
				sts({
					AwsClient: FakeClient,
					awsClientAssumeRole: "role",
					cacheExpiry: 50,
					fetchData: { key: { RoleArn: "arn:aws:iam::0:role/r" } },
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

	const expectSharedOptionError = (options, messagePart) => {
		let error;
		try {
			stsValidateOptions(options);
		} catch (e) {
			error = e;
		}
		ok(error instanceof TypeError, `expected a TypeError for ${messagePart}`);
		strictEqual(error.cause.package, "@middy/sts");
		ok(error.message.includes(messagePart), error.message);
	};

	test("stsValidateOptions validates awsClientOptions keys against the AWS SDK client config", () => {
		stsValidateOptions({
			awsClientOptions: {
				region: "us-east-1",
				endpoint: "https://example.com",
				credentials: async () => ({
					accessKeyId: "AKID",
					secretAccessKey: "secret",
				}),
			},
		});
		expectSharedOptionError(
			{ awsClientOptions: { regoin: "us-east-1" } },
			"awsClientOptions.regoin",
		);
	});

	test("stsValidateOptions accepts the STS client's useGlobalEndpoint config key", () => {
		stsValidateOptions({ awsClientOptions: { useGlobalEndpoint: true } });
		stsValidateOptions({
			awsClientOptions: { useGlobalEndpoint: async () => false },
		});
		expectSharedOptionError(
			{ awsClientOptions: { useGlobalEndpoint: "true" } },
			"awsClientOptions.useGlobalEndpoint",
		);
	});

	test("stsValidateOptions validates awsClientAssumeRole as an internal key name", () => {
		stsValidateOptions({ awsClientAssumeRole: "@middy/sts.role-arn:a/b_1!" });
		stsValidateOptions({ awsClientAssumeRole: "k".repeat(1024) });
		expectSharedOptionError(
			{ awsClientAssumeRole: "k".repeat(1025) },
			"awsClientAssumeRole",
		);
		expectSharedOptionError({ awsClientAssumeRole: "" }, "awsClientAssumeRole");
		expectSharedOptionError(
			{ awsClientAssumeRole: "a b" },
			"awsClientAssumeRole",
		);
	});

	test("stsValidateOptions validates contextKey as a key name", () => {
		stsValidateOptions({ contextKey: "@middy/ctx.name-a:b/c_1!" });
		stsValidateOptions({ contextKey: "k".repeat(1024) });
		expectSharedOptionError({ contextKey: "k".repeat(1025) }, "contextKey");
		expectSharedOptionError({ contextKey: "" }, "contextKey");
		expectSharedOptionError({ contextKey: "a b" }, "contextKey");
	});

	test("stsValidateOptions validates the cache options with the shared rules", () => {
		stsValidateOptions({
			cacheKey: "@middy/sts",
			cacheKeyExpiry: { "@middy/sts": 1000 },
		});
		expectSharedOptionError({ cacheKey: "a b" }, "cacheKey");
		expectSharedOptionError({ cacheKeyExpiry: { "a b": 1000 } }, "a b");
	});
});
