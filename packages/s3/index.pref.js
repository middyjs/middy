import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	const s3Response = (content) => {
		return {
			transformToString: async () => content,
		};
	};
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: S3Client,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const event = {};
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(event, context);
		} catch (e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(event, context);
		} catch (e) {}
	})

	.run();

console.table(bench.table());
