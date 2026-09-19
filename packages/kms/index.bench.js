import { bench } from "node:bench";
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const publicKeyDer = new Uint8Array(32).fill(1);
const keySpec = "RSA_2048";

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: KMSClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();
const warmFetchHandler = setupHandler({
	fetchData: { signingKey: "alias/my-signing-key" },
});
const warmSetToContextHandler = setupHandler({
	fetchData: { signingKey: "alias/my-signing-key" },
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

bench("kms: without cache", invoke(coldHandler));
bench("kms: with cache", invoke(warmHandler));
bench("kms: warm w/ fetchData (internal only)", invoke(warmFetchHandler));
bench("kms: warm w/ fetchData + setToContext", invoke(warmSetToContextHandler));
