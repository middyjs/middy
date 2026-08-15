import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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
	.add("warm w/ fetchData (internal only)", async () => {
		await warmFetchHandler(defaultEvent, defaultContext);
	})
	.add("warm w/ fetchData + setToContext", async () => {
		await warmSetToContextHandler(defaultEvent, defaultContext);
	})

	.run();

console.table(bench.table());
