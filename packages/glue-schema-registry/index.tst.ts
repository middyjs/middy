import { GlueClient } from "@aws-sdk/client-glue";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import glueSchemaRegistry, {
	type Context,
	type GlueSchemaRegistryOptions,
	type Internal,
	type ResolvedSchema,
} from "./index.js";

test("use with default options", () => {
	expect(glueSchemaRegistry()).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<undefined>,
			Internal<undefined>
		>
	>();
});

const options = {
	AwsClient: GlueClient,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
};

test("use with all options", () => {
	expect(glueSchemaRegistry(options)).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<typeof options>,
			Internal<typeof options>
		>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("setToContext: true", () => {
	handler
		.use(
			glueSchemaRegistry({
				...options,
				fetchData: { user: { SchemaVersionId: "abc" } },
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(
				request.context.middyContext["glue-schema-registry"].user,
			).type.toBe<ResolvedSchema>();

			const data = await getInternal("user", request);
			expect(data.user).type.toBe<ResolvedSchema>();
		});
});

test("internal holds only the fetchData entries", () => {
	// The runtime writes each fetchData entry onto request.internal and nothing
	// else, so the Internal type must not promise extra slots.
	expect<
		Internal<{ fetchData: { user: { SchemaVersionId: string } } }>
	>().type.toBe<{ user: ResolvedSchema }>();
	expect<keyof Internal<undefined>>().type.toBe<never>();
});

test("SchemaVersionNumber takes the SDK object form", () => {
	const schemaId = { SchemaName: "orders", RegistryName: "default" };
	expect(glueSchemaRegistry).type.toBeCallableWith({
		fetchData: {
			orders: { SchemaId: schemaId, SchemaVersionNumber: { VersionNumber: 3 } },
		},
	});
	expect(glueSchemaRegistry).type.toBeCallableWith({
		fetchData: {
			orders: {
				SchemaId: schemaId,
				SchemaVersionNumber: { LatestVersion: true },
			},
		},
	});
	expect(glueSchemaRegistry).type.not.toBeCallableWith({
		fetchData: {
			orders: { SchemaId: schemaId, SchemaVersionNumber: 3 },
		},
	});
});

test("setToContext: true with contextKey", () => {
	handler
		.use(
			glueSchemaRegistry({
				...options,
				fetchData: { user: { SchemaVersionId: "abc" } },
				setToContext: true,
				contextKey: "schemas" as const,
			}),
		)
		.before(async (request) => {
			expect(
				request.context.middyContext.schemas.user,
			).type.toBe<ResolvedSchema>();
		});
});

test("options declare contextKey", () => {
	expect<GlueSchemaRegistryOptions["contextKey"]>().type.toBe<
		string | undefined
	>();
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(
			glueSchemaRegistry({
				...options,
				fetchData: { user: { SchemaVersionId: "abc" } },
				setToContext: true,
				contextKey: "custom",
			}),
		)
		.before(async (request) => {
			expect(
				request.context.middyContext.custom.user,
			).type.toBe<ResolvedSchema>();
		});
});
