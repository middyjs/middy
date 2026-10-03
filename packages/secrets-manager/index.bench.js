import { bench, suite } from "node:bench";
import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(SecretsManagerClient)
		.on(GetSecretValueCommand)
		.resolves({ SecretString: "token" });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: SecretsManagerClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
// distinct cacheKey: an empty fetchData instance cannot share an entry with the fetchData ones
const warmHandler = setupHandler({ cacheKey: "warm-empty" });
const warmFetchHandler = setupHandler({
	fetchData: { token: "my-secret", apiKey: "my-api-key" },
});
const warmSetToContextHandler = setupHandler({
	fetchData: { token: "my-secret", apiKey: "my-api-key" },
	setToContext: true,
});

const defaultEvent = {};
suite("secrets-manager", () => {
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
	bench("warm w/ fetchData (internal only)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmFetchHandler(defaultEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("warm w/ fetchData + setToContext", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmSetToContextHandler(defaultEvent, defaultContext);
		}
		b.end(ops);
	});
});
