import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import {
	clearCache,
	getCache,
	getInternal,
	modifyCache,
} from "../util/index.js";
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
				SchemaVersionNumber: 3,
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

test("It should populate the consolidated glue-schema-registry slot", async () => {
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
		.before((request) => {
			const slot = request.internal["glue-schema-registry"];
			ok(slot, "consolidated slot should exist");
			ok(slot.schemas instanceof Map, ".schemas should be a Map");
			deepStrictEqual(slot.schemas.get("v-1"), {
				schemaDefinition: AVRO_SCHEMA,
				dataFormat: "AVRO",
			});
			strictEqual(slot.schema, AVRO_SCHEMA);
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
	const mock = mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "dyn-1",
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

	const first = await resolveSchemaVersion("dyn-1", opts, request);
	strictEqual(first.schemaVersionId, "dyn-1");
	strictEqual(first.dataFormat, "AVRO");

	const slot = request.internal["glue-schema-registry"];
	ok(slot.schemas.get("dyn-1"));
	strictEqual(slot.schema, AVRO_SCHEMA);

	await resolveSchemaVersion("dyn-1", opts, request);
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
		}),
	);

	await rejects(() => handler(defaultEvent, defaultContext), /glue boom/);
});

test("resolveSchemaVersion: prefetch path (canPrefetch true)", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "pf-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	const result = await resolveSchemaVersion(
		"pf-1",
		{ AwsClient: GlueClient, cacheKey: "glue-schema-registry", cacheExpiry: 0 },
		request,
	);
	strictEqual(result.schemaVersionId, "pf-1");
});

test("resolveSchemaVersion: caches undefined and rethrows on fetch failure", async () => {
	mockClient(GlueClient)
		.on(GetSchemaVersionCommand)
		.rejects(new Error("dyn boom"));

	const request = { internal: {}, context: {} };
	await rejects(
		() =>
			resolveSchemaVersion(
				"err-1",
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
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
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
});

test("middleware: buildSlot skips entries without schemaVersionId", async () => {
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
		.before((request) => {
			const slot = request.internal["glue-schema-registry"];
			strictEqual(slot.schemas.size, 0);
		});

	await handler(defaultEvent, defaultContext);
});

test("resolveSchemaVersion: reuses client across timer-driven refreshes", async () => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "tmr-1",
		SchemaDefinition: AVRO_SCHEMA,
		DataFormat: "AVRO",
	});

	const request = { internal: {}, context: {} };
	await resolveSchemaVersion(
		"tmr-1",
		{
			AwsClient: GlueClient,
			cacheKey: "glue-timer-refresh",
			cacheExpiry: 30,
			disablePrefetch: true,
		},
		request,
	);

	await new Promise((resolve) => setTimeout(resolve, 80));
	clearCache("glue-timer-refresh:tmr-1");
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
	}
	ok(threw, "expected TypeError for empty id");
});
