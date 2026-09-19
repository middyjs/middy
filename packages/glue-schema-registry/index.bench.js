import { bench } from "node:bench";
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(GlueClient).on(GetSchemaVersionCommand).resolves({
		SchemaVersionId: "v-1",
		SchemaDefinition: '{"type":"string"}',
		DataFormat: "AVRO",
	});
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: GlueClient,
			fetchData: { user: { SchemaVersionId: "v-1" } },
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};

bench("glue-schema-registry: without cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("glue-schema-registry: with cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
