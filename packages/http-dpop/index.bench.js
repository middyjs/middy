import { bench } from "node:bench";
import { generateKeyPairSync, sign } from "node:crypto";
import middy from "../core/index.js";
import httpDpop, { accessTokenHash, jwkThumbprint } from "./index.js";

// Public key verification is ~100x a plain middleware hop, so fewer per sample.
const operations = 100;

const defaultContext = { getRemainingTimeInMillis: () => 30000 };

const DOMAIN = "api.example.com";
const PATH = "/v1/things";
const TOKEN = "an.access.token";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const proofFor = (alg, privateKey, jwk, hash, options) => {
	const header = b64({ typ: "dpop+jwt", alg, jwk });
	const payload = b64({
		jti: "proof-1",
		htm: "GET",
		htu: `https://${DOMAIN}${PATH}`,
		iat: Math.floor(Date.now() / 1000),
		ath: accessTokenHash(TOKEN),
	});
	const signature = sign(hash, Buffer.from(`${header}.${payload}`), {
		key: privateKey,
		...options,
	}).toString("base64url");
	return `${header}.${payload}.${signature}`;
};

const setup = (alg, keypair, hash, options = {}) => {
	const { privateKey, publicKey } = keypair();
	const { d, ...jwk } = publicKey.export({ format: "jwk" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.jwt = { cnf: { jkt: jwkThumbprint(jwk) } };
		})
		.use(httpDpop());
	const event = {
		rawPath: PATH,
		headers: {
			authorization: `DPoP ${TOKEN}`,
			dpop: proofFor(alg, privateKey, jwk, hash, options),
		},
		requestContext: { domainName: DOMAIN, http: { method: "GET" } },
	};
	return { handler, event };
};

const ed25519 = setup("EdDSA", () => generateKeyPairSync("ed25519"), null);
const p256 = setup(
	"ES256",
	() => generateKeyPairSync("ec", { namedCurve: "P-256" }),
	"SHA256",
	{ dsaEncoding: "ieee-p1363" },
);
const rsa = setup(
	"RS256",
	() => generateKeyPairSync("rsa", { modulusLength: 2048 }),
	"SHA256",
);

// An unbound token skips every check, so this is the cost the middleware adds
// to callers who have not adopted DPoP.
const unbound = (() => {
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.jwt = { sub: "user-1" };
		})
		.use(httpDpop());
	return {
		handler,
		event: {
			rawPath: PATH,
			headers: { authorization: `Bearer ${TOKEN}` },
			requestContext: { domainName: DOMAIN, http: { method: "GET" } },
		},
	};
})();

const verify =
	({ handler, event }) =>
	async (b) => {
		b.start();
		for (let i = 0; i < operations; i++) {
			await handler(event, defaultContext);
		}
		b.end(operations);
	};

bench("http-dpop: verify EdDSA proof", verify(ed25519));
bench("http-dpop: verify ES256 proof", verify(p256));
bench("http-dpop: verify RS256 proof", verify(rsa));
bench("http-dpop: skip an unbound token", verify(unbound));
