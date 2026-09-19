import { bench } from "node:bench";
import { PublicProtocol } from "paseto";
import { SecretKeyFromCryptoKey, SignFactory } from "paseto/v4/public";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

// Ed25519 verification dominates the invocation, so fewer per sample.
const operations = 100;

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

const event = { headers: { authorization: `Bearer ${token}` } };

bench("http-paseto: verify v4.public token", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmHandler(event, defaultContext);
	}
	b.end(operations);
});
