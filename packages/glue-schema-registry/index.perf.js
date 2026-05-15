import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
