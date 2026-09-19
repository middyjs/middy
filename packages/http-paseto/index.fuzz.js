// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import fc from "fast-check";
import { PublicProtocol } from "paseto";
import { SecretKeyFromCryptoKey, SignFactory } from "paseto/v4/public";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const pair = await crypto.subtle.generateKey("Ed25519", true, [
	"sign",
	"verify",
]);
const spkiDer = new Uint8Array(
	await crypto.subtle.exportKey("spki", pair.publicKey),
);
const validToken = await new PublicProtocol(SignFactory).Sign(
	await SecretKeyFromCryptoKey(pair.privateKey),
	{ sub: "fuzz" },
	{ expiresIn: 3600 },
);

const handler = middy((event) => event)
	.before((request) => {
		request.internal.pubKey = spkiDer;
	})
	.use(httpPaseto({ internalKey: "pubKey" }));

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

test("fuzz `event` w/ valid Bearer token + random headers", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(fc.string({ minLength: 1, maxLength: 32 }), fc.string()),
			async (extraHeaders) => {
				await safeRun({
					headers: {
						...extraHeaders,
						authorization: `Bearer ${validToken}`,
					},
				});
			},
		),
		{ numRuns: 10_000, examples: [] },
	);
});
