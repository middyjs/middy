import { bench, suite } from "node:bench";
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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
// distinct cacheKey: an empty fetchData instance cannot share an entry with the fetchData ones
const warmHandler = setupHandler({ cacheKey: "warm-empty" });
const warmFetchHandler = setupHandler({
	fetchData: { signingKey: "alias/my-signing-key" },
});
const warmSetToContextHandler = setupHandler({
	fetchData: { signingKey: "alias/my-signing-key" },
	setToContext: true,
});

const defaultEvent = {};
suite("kms", () => {
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
