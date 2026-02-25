import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

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
