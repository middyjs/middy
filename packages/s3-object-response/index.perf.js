import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const defaultContext = {
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

const defaultEvent = {
	getObjectContext: {
		inputS3Url: "https://localhost",
	},
};
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(event, context);
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(event, context);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
