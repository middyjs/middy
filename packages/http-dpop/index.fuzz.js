// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import httpDpop, { accessTokenHash, jwkThumbprint } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const DOMAIN = "api.example.com";
const PATH = "/v1/things";
const TOKEN = "an.access.token";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const { d, ...jwk } = publicKey.export({ format: "jwk" });
const jkt = jwkThumbprint(jwk);

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const validProof = () => {
	const header = b64({ typ: "dpop+jwt", alg: "EdDSA", jwk });
	const payload = b64({
		jti: "proof-1",
		htm: "GET",
		htu: `https://${DOMAIN}${PATH}`,
		iat: Math.floor(Date.now() / 1000),
		ath: accessTokenHash(TOKEN),
	});
	const signature = sign(
		null,
		Buffer.from(`${header}.${payload}`),
		privateKey,
	).toString("base64url");
	return `${header}.${payload}.${signature}`;
};

const handler = middy((event) => event)
	.before((request) => {
		request.internal.jwt = { sub: "user-1", cnf: { jkt } };
	})
	.use(httpDpop());

const safeRun = async (event) => {
	try {
		await handler(event, defaultContext);
	} catch (err) {
		if (err.name === "TypeError" || err.name === "RangeError") throw err;
	}
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(fc.asyncProperty(fc.object(), safeRun), {
		numRuns: 10_000,
		examples: [],
	});
});

test("fuzz `event` w/ `headers` record", async () => {
	await fc.assert(
		fc.asyncProperty(fc.record({ headers: fc.object() }), safeRun),
		{ numRuns: 10_000, examples: [] },
	);
});

test("fuzz `DPoP` header w/ `string`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (dpop) => {
			await safeRun({
				rawPath: PATH,
				headers: { authorization: `DPoP ${TOKEN}`, dpop },
				requestContext: { domainName: DOMAIN, http: { method: "GET" } },
			});
		}),
		{ numRuns: 10_000, examples: [] },
	);
});

// Structurally valid segments carrying arbitrary JSON: exercises the claim
// checks rather than the base64url decode.
test("fuzz `DPoP` header w/ well-formed segments", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), fc.object(), async (header, payload) => {
			await safeRun({
				rawPath: PATH,
				headers: {
					authorization: `DPoP ${TOKEN}`,
					dpop: `${b64(header)}.${b64(payload)}.AA`,
				},
				requestContext: { domainName: DOMAIN, http: { method: "GET" } },
			});
		}),
		{ numRuns: 10_000, examples: [] },
	);
});

test("fuzz `event` w/ a valid proof + random headers", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(fc.string({ minLength: 1, maxLength: 32 }), fc.string()),
			async (extraHeaders) => {
				await safeRun({
					rawPath: PATH,
					headers: {
						...extraHeaders,
						authorization: `DPoP ${TOKEN}`,
						dpop: validProof(),
					},
					requestContext: { domainName: DOMAIN, http: { method: "GET" } },
				});
			},
		),
		{ numRuns: 10_000, examples: [] },
	);
});
