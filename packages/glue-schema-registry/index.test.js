import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { test } from "node:test";
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import { clearCache, getCache, getInternal, modifyCache } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import glueSchemaRegistry, {
	glueSchemaRegistryParam,
	glueSchemaRegistryValidateOptions,
	resolveSchemaVersion,
} from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const AVRO_SCHEMA =
	'{"type":"record","name":"User","fields":[{"name":"id","type":"string"}]}';

test("validateOptions accepts SchemaVersionId form", () => {
	glueSchemaRegistryValidateOptions({
		fetchData: { user: { SchemaVersionId: "uuid" } },
	});
});

test("validateOptions accepts SchemaId+SchemaVersionNumber form", () => {
	glueSchemaRegistryValidateOptions({
		fetchData: {
			user: {
				SchemaId: { SchemaName: "user", RegistryName: "default" },
				SchemaVersionNumber: { VersionNumber: 3 },
			},
		},
	});
});

test("It should resolve a schema by SchemaVersionId into request.internal", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolvesOnce({
		SchemaVersionId: "v-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler
		.use(
			glueSchemaRegistry({
				AwsClient: GlueClient,
				cacheExpiry: 0,
				fetchData: { user: { SchemaVersionId: "v-1" } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			deepStrictEqual(values.user, {
				schemaVersionId: "v-1",
				schemaDefinition: AVRO_SCHEMA,
				dataFormat: "AVRO",
			});
		});

	await handler(defaultEvent, defaultContext);
});

test("It should populate request.internal entries keyed by fetchData", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolvesOnce({
		SchemaVersionId: "v-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler
		.use(
			glueSchemaRegistry({
				AwsClient: GlueClient,
				cacheExpiry: 0,
				fetchData: { user: { SchemaVersionId: "v-1" } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const entry = await request.internal.user;
			deepStrictEqual(entry, {
				schemaVersionId: "v-1",
				schemaDefinition: AVRO_SCHEMA,
				dataFormat: "AVRO",
			});
		});

	await handler(defaultEvent, defaultContext);
});

test("It should setToContext when enabled", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolvesOnce({
		SchemaVersionId: "v-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy((event, context) => {
		deepStrictEqual(context.user, {
			schemaVersionId: "v-1",
			schemaDefinition: AVRO_SCHEMA,
			dataFormat: "AVRO",
		});
	});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: 0,
			fetchData: { user: { SchemaVersionId: "v-1" } },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	await handler(defaultEvent, { ...defaultContext });
});

test("It should hit cache on second invocation", async () => {
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: -1,
			fetchData: { user: { SchemaVersionId: "v-1" } },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);
});

test("resolveSchemaVersion fetches and caches dynamically", async () => {
	const dynId = "00000000-0000-0000-0000-0000000000d1";
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: dynId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = {
		internal: {},
		context: {},
	};

	const opts = {
		AwsClient: GlueClient,
		cacheKey: "glue-schema-registry",
		cacheExpiry: -1,
		disablePrefetch: true,
	};

	const first = await resolveSchemaVersion(dynId, opts, request);
	strictEqual(first.schemaVersionId, dynId);
	strictEqual(first.dataFormat, "AVRO");
	strictEqual(first.schemaDefinition, AVRO_SCHEMA);

	await resolveSchemaVersion(dynId, opts, request);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);
});

test("middleware: prefetches client + schemas when prefetch enabled", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-pf",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: -1,
			fetchData: { user: { SchemaVersionId: "v-pf" } },
		}),
	);

	await handler(defaultEvent, defaultContext);
});

test("middleware: caches undefined and rethrows on fetch failure", async () => {
	mockClient(GlueClient)
		.on(GetSchemaVersionCommand)
		.rejects(new Error("glue boom"));

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: 0,
			fetchData: { user: { SchemaVersionId: "v-x" } },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	await rejects(
		() => handler(defaultEvent, defaultContext),
		(e) => {
			strictEqual(e.message, "Failed to resolve internal values");
			// The original rejection reason must survive untouched; the error-cache
			// fallback must not replace it with an incidental TypeError.
			strictEqual(e.cause.data[0].message, "glue boom");
			return true;
		},
	);
});

test("resolveSchemaVersion: prefetch path (canPrefetch true)", async () => {
	const pfId = "00000000-0000-0000-0000-0000000000f1";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: pfId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	const result = await resolveSchemaVersion(
		pfId,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-schema-registry",
			cacheExpiry: -1,
		},
		request,
	);
	strictEqual(result.schemaVersionId, pfId);
});

test("resolveSchemaVersion: caches undefined and rethrows on fetch failure", async () => {
	mockClient(GlueClient)
		.on(GetSchemaVersionCommand)
		.rejects(new Error("dyn boom"));

	const request = { internal: {}, context: {} };
	await rejects(
		() =>
			resolveSchemaVersion(
				"00000000-0000-0000-0000-00000000e001",
				{
					AwsClient: GlueClient,
					cacheKey: "glue-schema-registry",
					cacheExpiry: 0,
					disablePrefetch: true,
				},
				request,
			),
		/dyn boom/,
	);
});

test("glueSchemaRegistryParam returns the name", () => {
	strictEqual(glueSchemaRegistryParam("user"), "user");
});

test("middleware: skips refetch when modified-cache already has truthy entry", async () => {
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-cached",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: -1,
			cacheKey: "glue-skip-refetch",
			fetchData: { user: { SchemaVersionId: "v-cached" } },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);

	const cached = getCache("glue-skip-refetch");
	const truthyEntry = await cached.value.user;
	modifyCache("glue-skip-refetch", { user: truthyEntry });

	await handler(defaultEvent, defaultContext);
	// The truthy modified-cache entry must short-circuit the per-key fetch loop;
	// no second GetSchemaVersionCommand should be issued.
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);
});

test("middleware: entries without schemaVersionId still land on internal", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: undefined,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler
		.use(
			glueSchemaRegistry({
				AwsClient: GlueClient,
				cacheExpiry: 0,
				fetchData: { user: { SchemaVersionId: "v-noid" } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const entry = await request.internal.user;
			strictEqual(entry.schemaVersionId, undefined);
			strictEqual(entry.schemaDefinition, AVRO_SCHEMA);
		});

	await handler(defaultEvent, defaultContext);
});

test("resolveSchemaVersion: reuses client across timer-driven refreshes", async () => {
	const tmrId = "00000000-0000-0000-0000-00000000a001";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: tmrId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	await resolveSchemaVersion(
		tmrId,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-timer-refresh",
			cacheExpiry: 30,
			disablePrefetch: true,
		},
		request,
	);

	await new Promise((resolve) => setTimeout(resolve, 80));
	clearCache(`glue-timer-refresh:${tmrId}`);
});

test("resolveSchemaVersion: cacheKeyExpiry override (keyed on base cacheKey) takes effect", async () => {
	const expId = "00000000-0000-0000-0000-00000000e0f1";
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: expId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	const opts = {
		AwsClient: GlueClient,
		cacheKey: "glue-schema-registry",
		// Infinite by default, but the per-key override disables caching for this
		// base cacheKey, so the second resolve must refetch.
		cacheExpiry: -1,
		cacheKeyExpiry: { "glue-schema-registry": 0 },
		disablePrefetch: true,
	};

	await resolveSchemaVersion(expId, opts, request);
	await resolveSchemaVersion(expId, opts, request);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 2);
});

test("resolveSchemaVersion rejects empty schemaVersionId", async () => {
	let threw = false;
	try {
		await resolveSchemaVersion(
			"",
			{ cacheKey: "glue-schema-registry" },
			{
				internal: {},
			},
		);
	} catch (e) {
		threw = true;
		ok(e instanceof TypeError);
		strictEqual(e.message, "resolveSchemaVersion: schemaVersionId required");
	}
	ok(threw, "expected TypeError for empty id");
});

test("resolveSchemaVersion rejects non-string schemaVersionId", async () => {
	await rejects(
		() =>
			resolveSchemaVersion(
				123,
				{ cacheKey: "glue-schema-registry" },
				{
					internal: {},
				},
			),
		(e) => {
			ok(e instanceof TypeError);
			strictEqual(e.message, "resolveSchemaVersion: schemaVersionId required");
			return true;
		},
	);
});

test("resolveSchemaVersion rejects a non-UUID schemaVersionId (no Glue call)", async () => {
	// A non-UUID schemaVersionId is realistically derived from attacker-controlled
	// message bytes. It must be rejected the same way other invalid input is,
	// before composing a cache key or issuing a billed Glue GetSchemaVersion call.
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "not-a-uuid",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});
	await rejects(
		() =>
			resolveSchemaVersion(
				"not-a-uuid",
				{ cacheKey: "glue-schema-registry" },
				{
					internal: {},
				},
			),
		(e) => {
			ok(e instanceof TypeError);
			strictEqual(e.message, "resolveSchemaVersion: schemaVersionId required");
			return true;
		},
	);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 0);
});

test("resolveSchemaVersion accepts a canonical UUID schemaVersionId", async () => {
	const uuid = "12345678-1234-1234-1234-123456789012";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: uuid,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	const result = await resolveSchemaVersion(
		uuid,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-schema-registry",
			cacheExpiry: 0,
			disablePrefetch: true,
		},
		request,
	);
	strictEqual(result.schemaVersionId, uuid);
	strictEqual(result.schemaDefinition, AVRO_SCHEMA);
});

// --- option validation: each rule must both accept valid + reject invalid ---

test("validateOptions errors carry the package name in cause", () => {
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheKey: 123 }),
		(e) => {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/glue-schema-registry");
			return true;
		},
	);
});

test("validateOptions rejects unknown top-level options", () => {
	throws(
		() => glueSchemaRegistryValidateOptions({ notARealOption: 1 }),
		/Unknown option 'notARealOption'/,
	);
});

test("validateOptions enforces AwsClient must be a Function", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ AwsClient: GlueClient }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ AwsClient: 123 }),
		/AwsClient.*instanceof Function/,
	);
});

test("validateOptions enforces awsClientOptions must be an object", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ awsClientOptions: { region: "us" } }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ awsClientOptions: "nope" }),
		/awsClientOptions.*must be object/,
	);
});

test("validateOptions enforces awsClientAssumeRole must be a string", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ awsClientAssumeRole: "role" }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ awsClientAssumeRole: 123 }),
		/awsClientAssumeRole.*must be string/,
	);
});

test("validateOptions enforces awsClientCapture must be a Function", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ awsClientCapture: () => {} }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ awsClientCapture: "nope" }),
		/awsClientCapture.*instanceof Function/,
	);
});

test("validateOptions enforces disablePrefetch must be a boolean", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ disablePrefetch: true }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ disablePrefetch: "nope" }),
		/disablePrefetch.*must be boolean/,
	);
});

test("validateOptions enforces cacheKey must be a string", () => {
	doesNotThrow(() => glueSchemaRegistryValidateOptions({ cacheKey: "k" }));
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheKey: 123 }),
		/cacheKey.*must be string/,
	);
});

test("validateOptions enforces cacheKeyExpiry numeric values >= -1", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({ cacheKeyExpiry: { k: -1 } }),
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheKeyExpiry: { k: "x" } }),
		/cacheKeyExpiry\.k.*must be number/,
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheKeyExpiry: { k: -2 } }),
		/cacheKeyExpiry\.k.*must be >= -1/,
	);
});

test("validateOptions enforces cacheExpiry must be a number >= -1", () => {
	doesNotThrow(() => glueSchemaRegistryValidateOptions({ cacheExpiry: -1 }));
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheExpiry: "x" }),
		/cacheExpiry.*must be number/,
	);
	throws(
		() => glueSchemaRegistryValidateOptions({ cacheExpiry: -2 }),
		/cacheExpiry.*must be >= -1/,
	);
});

test("validateOptions enforces setToContext must be a boolean", () => {
	doesNotThrow(() => glueSchemaRegistryValidateOptions({ setToContext: true }));
	throws(
		() => glueSchemaRegistryValidateOptions({ setToContext: "nope" }),
		/setToContext.*must be boolean/,
	);
});

test("validateOptions: fetchData SchemaVersionId branch enforces string", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({
			fetchData: { user: { SchemaVersionId: "uuid" } },
		}),
	);
	// non-string SchemaVersionId matches neither oneOf branch
	throws(
		() =>
			glueSchemaRegistryValidateOptions({
				fetchData: { user: { SchemaVersionId: 123 } },
			}),
		/fetchData\.user.*oneOf/,
	);
});

test("validateOptions: fetchData SchemaVersionId branch allows extra keys", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({
			fetchData: { user: { SchemaVersionId: "uuid", extra: 1 } },
		}),
	);
});

test("validateOptions: fetchData SchemaId object enforces string fields + extras", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({
			fetchData: {
				user: {
					SchemaId: {
						SchemaName: "user",
						RegistryName: "default",
						SchemaArn: "arn:aws:glue:::schema/user",
						extra: 1,
					},
					SchemaVersionNumber: { VersionNumber: 1 },
				},
			},
		}),
	);
	throws(
		() =>
			glueSchemaRegistryValidateOptions({
				fetchData: {
					user: {
						SchemaId: { SchemaArn: 123 },
						SchemaVersionNumber: { VersionNumber: 1 },
					},
				},
			}),
		/fetchData\.user.*oneOf/,
	);
});

test("validateOptions: fetchData SchemaVersionNumber enforces integer >= 1 + boolean + extras", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({
			fetchData: {
				user: {
					SchemaId: { SchemaName: "user" },
					SchemaVersionNumber: {
						VersionNumber: 3,
						LatestVersion: true,
						extra: 1,
					},
				},
			},
		}),
	);
	throws(
		() =>
			glueSchemaRegistryValidateOptions({
				fetchData: {
					user: {
						SchemaId: { SchemaName: "user" },
						SchemaVersionNumber: { LatestVersion: "nope" },
					},
				},
			}),
		/fetchData\.user.*oneOf/,
	);
});

test("validateOptions: fetchData SchemaId branch allows extra keys on entry", () => {
	doesNotThrow(() =>
		glueSchemaRegistryValidateOptions({
			fetchData: {
				user: {
					SchemaId: { SchemaName: "user" },
					SchemaVersionNumber: { VersionNumber: 1 },
					extra: 1,
				},
			},
		}),
	);
});

// --- defaults-driven runtime behavior ---

test("defaults: cacheKey defaults to the package name", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-default-key",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: -1,
			fetchData: { user: { SchemaVersionId: "v-default-key" } },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);

	const cached = getCache("@middy/glue-schema-registry");
	ok(cached.value, "expected cache stored under default package cacheKey");
	deepStrictEqual(Object.keys(cached.value), ["user"]);
});

test("defaults: cacheExpiry defaults to -1 (infinite) so values survive across delay", async () => {
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-inf",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			// cacheExpiry omitted: relies on default -1
			fetchData: { user: { SchemaVersionId: "v-inf" } },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	await new Promise((resolve) => setTimeout(resolve, 30));
	await handler(defaultEvent, defaultContext);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);
});

test("defaults: setToContext defaults to false (context left untouched)", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-noctx",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	let observedContextUser = "UNSET";
	const handler = middy((event, context) => {
		observedContextUser = context.user;
	});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: 0,
			// setToContext omitted: relies on default false
			fetchData: { user: { SchemaVersionId: "v-noctx" } },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, { ...defaultContext });
	strictEqual(observedContextUser, undefined);
});

test("middleware: prefetch issues the fetch at factory time (default disablePrefetch false)", async () => {
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-pf2",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: -1,
			fetchData: { user: { SchemaVersionId: "v-pf2" } },
		}),
	);

	// Prefetch must have already sent the command before any invocation.
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);

	await handler(defaultEvent, defaultContext);
	// Still cached: no extra call from the before-hook.
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 1);
});

test("middleware: prefetch creates the client exactly once (reused in before-hook)", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-once",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	let instantiations = 0;
	class CountingClient extends GlueClient {
		constructor(options) {
			super(options);
			instantiations++;
		}
	}

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: CountingClient,
			cacheExpiry: -1,
			fetchData: { user: { SchemaVersionId: "v-once" } },
		}),
	);

	await handler(defaultEvent, defaultContext);
	// The prefetched client must be reused: the before-hook must NOT build a
	// second client.
	strictEqual(instantiations, 1);
});

test("middleware: sends GetSchemaVersionCommand with the configured fetchData input", async () => {
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-input",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const handler = middy(() => {});
	handler.use(
		glueSchemaRegistry({
			AwsClient: GlueClient,
			cacheExpiry: 0,
			fetchData: {
				user: {
					SchemaId: { SchemaName: "user", RegistryName: "default" },
					SchemaVersionNumber: { VersionNumber: 2 },
				},
			},
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	const calls = mock.commandCalls(GetSchemaVersionCommand);
	strictEqual(calls.length, 1);
	deepStrictEqual(calls[0].args[0].input, {
		SchemaId: { SchemaName: "user", RegistryName: "default" },
		SchemaVersionNumber: { VersionNumber: 2 },
	});
});

test("middleware: retries on InvalidSignatureException then resolves", async () => {
	const signatureError = Object.assign(new Error("bad signature"), {
		__type: "InvalidSignatureException",
	});
	const mock = mockClient(GlueClient)
		.on(GetSchemaVersionCommand)
		.rejectsOnce(signatureError)
		.resolves({
			SchemaVersionId: "v-retry",
			SchemaDefinition: AVRO_SCHEMA,
			DataFormat: "AVRO",
		});

	const handler = middy(() => {});
	handler
		.use(
			glueSchemaRegistry({
				AwsClient: GlueClient,
				cacheExpiry: 0,
				fetchData: { user: { SchemaVersionId: "v-retry" } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const entry = await request.internal.user;
			strictEqual(entry.schemaVersionId, "v-retry");
			strictEqual(entry.schemaDefinition, AVRO_SCHEMA);
		});

	await handler(defaultEvent, defaultContext);
	strictEqual(mock.commandCalls(GetSchemaVersionCommand).length, 2);
});

// --- resolveSchemaVersion behavior ---

test("resolveSchemaVersion sends command with the exact schemaVersionId", async () => {
	const exactId = "00000000-0000-0000-0000-00000000ec01";
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: exactId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	await resolveSchemaVersion(
		exactId,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-schema-registry",
			cacheExpiry: 0,
			disablePrefetch: true,
		},
		request,
	);
	deepStrictEqual(mock.commandCalls(GetSchemaVersionCommand)[0].args[0].input, {
		SchemaVersionId: exactId,
	});
});

test("resolveSchemaVersion stores cache under composed cacheKey", async () => {
	const compId = "00000000-0000-0000-0000-00000000c0f1";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: compId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	await resolveSchemaVersion(
		compId,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-schema-registry",
			cacheExpiry: -1,
			disablePrefetch: true,
		},
		request,
	);

	ok(
		getCache(`glue-schema-registry:${compId}`).value,
		"expected cache under composed cacheKey:schemaVersionId",
	);
});

test("resolveSchemaVersion tolerates an explicitly undefined cacheKeyExpiry", async () => {
	const undefExpId = "00000000-0000-0000-0000-0000000ed001";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: undefExpId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	const result = await resolveSchemaVersion(
		undefExpId,
		{
			AwsClient: GlueClient,
			cacheKey: "glue-schema-registry",
			cacheExpiry: 0,
			cacheKeyExpiry: undefined,
			disablePrefetch: true,
		},
		request,
	);
	strictEqual(result.schemaVersionId, undefExpId);
});

test("resolveSchemaVersion reuses the client across timer-driven refreshes (single instantiation)", async () => {
	const tmrReuseId = "00000000-0000-0000-0000-00000000a0f1";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: tmrReuseId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	let instantiations = 0;
	class CountingClient extends GlueClient {
		constructor(options) {
			super(options);
			instantiations++;
		}
	}

	const request = { internal: {}, context: {} };
	await resolveSchemaVersion(
		tmrReuseId,
		{
			AwsClient: CountingClient,
			cacheKey: "glue-timer-reuse",
			cacheExpiry: 30,
			disablePrefetch: true,
		},
		request,
	);

	await new Promise((resolve) => setTimeout(resolve, 90));
	clearCache(`glue-timer-reuse:${tmrReuseId}`);
	strictEqual(instantiations, 1);
});

test("resolveSchemaVersion assumes role: credentials reach the client (no-prefetch path)", async () => {
	const roleId = "00000000-0000-0000-0000-0000000c0de1";
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: roleId,
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	let receivedOptions = null;
	class CapturingClient extends GlueClient {
		constructor(options) {
			super(options);
			receivedOptions = options;
		}
	}

	const request = {
		internal: {
			credentials: { accessKeyId: "AK", secretAccessKey: "SK" },
		},
		context: {},
	};
	const result = await resolveSchemaVersion(
		roleId,
		{
			AwsClient: CapturingClient,
			cacheKey: "glue-role",
			cacheExpiry: 0,
			awsClientAssumeRole: "credentials",
		},
		request,
	);
	strictEqual(result.schemaVersionId, roleId);
	// canPrefetch is false when assuming a role, so createClient must run and
	// thread the resolved credentials into the client constructor.
	deepStrictEqual(receivedOptions.credentials, {
		accessKeyId: "AK",
		secretAccessKey: "SK",
	});
});
