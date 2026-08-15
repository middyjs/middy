import { GlueClient } from "@aws-sdk/client-glue";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import glueSchemaRegistry, {
	type Context,
	type Internal,
	type ResolvedSchema,
	type SchemaSlot,
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
			expect(request.context.user).type.toBe<ResolvedSchema>();

			const data = await getInternal("user", request);
			expect(data.user).type.toBe<ResolvedSchema>();
		});
});

test("consolidated slot present in internal", () => {
	handler
		.use(
			glueSchemaRegistry({
				...options,
				fetchData: { user: { SchemaVersionId: "abc" } },
			}),
		)
		.before(async (request) => {
			// getInternal sanitizes "-" to "_" in returned object keys; verify
			// the property is reachable in the typed result. Map methods get
			// erased to {} through getInternal's return-type construction, so we
			// only assert the wider object shape (assignable-from).
			const data = await getInternal("glue-schema-registry", request);
			expect(data.glue_schema_registry).type.toBeAssignableFrom<SchemaSlot>();
		});
});
