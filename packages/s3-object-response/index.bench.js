import { bench } from "node:bench";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

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

bench("s3-object-response: without cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("s3-object-response: with cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
