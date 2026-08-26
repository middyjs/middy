import { generateKeyPairSync, sign } from "node:crypto";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import httpDpop, { accessTokenHash, jwkThumbprint } from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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

await bench
	.add("verify EdDSA proof", async () => {
		await ed25519.handler(ed25519.event, defaultContext);
	})
	.add("verify ES256 proof", async () => {
		await p256.handler(p256.event, defaultContext);
	})
	.add("verify RS256 proof", async () => {
		await rsa.handler(rsa.event, defaultContext);
	})
	.add("skip an unbound token", async () => {
		await unbound.handler(unbound.event, defaultContext);
	})

	.run();

console.table(bench.table());
