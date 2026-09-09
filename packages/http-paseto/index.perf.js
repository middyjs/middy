import { PublicProtocol } from "paseto";
import { SecretKeyFromCryptoKey, SignFactory } from "paseto/v4/public";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = { getRemainingTimeInMillis: () => 30000 };

const pair = await crypto.subtle.generateKey("Ed25519", true, [
	"sign",
	"verify",
]);
const pubBytes = new Uint8Array(
	await crypto.subtle.exportKey("spki", pair.publicKey),
);
const token = await new PublicProtocol(SignFactory).Sign(
	await SecretKeyFromCryptoKey(pair.privateKey),
	{ sub: "user-1" },
	{ expiresIn: 3600 },
);

const setupHandler = () =>
	middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = pubBytes;
		})
		.use(httpPaseto({ internalKey: "pubKey" }));

const warmHandler = setupHandler();

await bench
	.add("verify v4.public token", async () => {
		await warmHandler(
			{ headers: { authorization: `Bearer ${token}` } },
			defaultContext,
		);
	})

	.run();

console.table(bench.table());
