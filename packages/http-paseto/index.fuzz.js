// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey } from "node:crypto";
import { test } from "node:test";
import fc from "fast-check";
import { V4 } from "paseto";
import middy from "../core/index.js";
import httpPaseto from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const privateKey = await V4.generateKey("public");
const publicKey = createPublicKey(privateKey);
const spkiDer = publicKey.export({ type: "spki", format: "der" });
const validToken = await V4.sign({ sub: "fuzz" }, privateKey, {
	expiresIn: "1h",
});

const handler = middy((event) => event)
	.before((request) => {
		request.internal.pubKey = new Uint8Array(spkiDer);
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
