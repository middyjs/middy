import { bench } from "node:bench";
import {
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

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
const warmFetchHandler = setupHandler({
	fetchData: { token: "my-secret", apiKey: "my-api-key" },
});
const warmSetToContextHandler = setupHandler({
	fetchData: { token: "my-secret", apiKey: "my-api-key" },
	setToContext: true,
});

const defaultEvent = {};

const invoke = (handler) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench("secrets-manager: without cache", invoke(coldHandler));
bench("secrets-manager: with cache", invoke(warmHandler));
bench(
	"secrets-manager: warm w/ fetchData (internal only)",
	invoke(warmFetchHandler),
);
bench(
	"secrets-manager: warm w/ fetchData + setToContext",
	invoke(warmSetToContextHandler),
);
