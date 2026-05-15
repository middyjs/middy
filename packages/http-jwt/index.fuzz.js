// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import fc from "fast-check";
import { SignJWT } from "jose";
import middy from "../core/index.js";
import httpJwt from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const secret = "super-secret-key-for-fuzz-testing-1234";
const validToken = await new SignJWT({ sub: "fuzz" })
	.setProtectedHeader({ alg: "HS256" })
	.setIssuedAt()
	.setExpirationTime("1h")
	.sign(Buffer.from(secret));

const handler = middy((event) => event).use(
	httpJwt({ secretKey: secret, algorithm: "HS256" }),
);

const safeRun = async (event) => {
	try {
		await handler(event, defaultContext);
	} catch (err) {
		if (err.name === "TypeError" || err.name === "RangeError") throw err;
	}
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(fc.asyncProperty(fc.object(), safeRun), {
		numRuns: 100_000,
		examples: [],
	});
});

test("fuzz `event` w/ `headers` record", async () => {
	await fc.assert(
		fc.asyncProperty(fc.record({ headers: fc.object() }), safeRun),
		{ numRuns: 100_000, examples: [] },
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
