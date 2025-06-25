import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};

globalThis.fetch = () => Promise.resolve();
const setupHandler = (options = {}) => {
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolves({ statusCode: 200 });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: S3Client,
		}),
	);
};

const coldHandler = setupHandler({ disablePrefetch: true });
const warmHandler = setupHandler();

const event = {
	getObjectContext: {
		inputS3Url: "http://localhost",
	},
};
await bench
	.add("without cache", async () => {
		await coldHandler(event, context);
	})
	.add("with cache", async () => {
		await warmHandler(event, context);
	})

	.run();

console.table(bench.table());
