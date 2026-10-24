import { bench, suite } from "node:bench";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
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

const defaultEvent = {};
suite("s3", () => {
	bench("without cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await coldHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("with cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
