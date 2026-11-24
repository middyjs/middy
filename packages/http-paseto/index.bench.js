import { bench, suite } from "node:bench";
import { PublicProtocol } from "paseto";
import { SecretKeyFromCryptoKey, SignFactory } from "paseto/v4/public";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 100;

const defaultContext = { getRemainingTimeInMillis: () => 30000 };

const pair = await crypto.subtle.generateKey("Ed25519", true, [
	"sign",
	"verify",
]);
const pubBytes = new Uint8Array(
	await crypto.subtle.exportKey("spki", pair.publicKey),
);
const audience = "https://api.example.com";
const issuer = "https://auth.example.com";
const token = await new PublicProtocol(SignFactory).Sign(
	await SecretKeyFromCryptoKey(pair.privateKey),
	{ sub: "user-1", aud: audience, iss: issuer },
	{ expiresIn: 3600 },
);

const setupHandler = () =>
	middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = pubBytes;
		})
		.use(httpPaseto({ internalKey: "pubKey", audience, issuer }));

const warmHandler = setupHandler();

suite("http-paseto", () => {
	bench("verify v4.public token", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
		}
		b.end(ops);
	});
});
