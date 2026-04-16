import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const handler = middy((event) => event).use(middleware());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				headers: fc.object(),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz idempotency: normalizing twice equals normalizing once", async () => {
	const headersArb = fc.dictionary(fc.string({ minLength: 1 }), fc.string());
	await fc.assert(
		fc.asyncProperty(headersArb, async (headers) => {
			const event1 = { headers: { ...headers } };
			const once = await handler(event1, defaultContext);
			const twice = await handler(
				{ headers: { ...once.headers } },
				defaultContext,
			);
			deepStrictEqual(once.headers, twice.headers);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz all header keys are lowercase after normalization (default mode)", async () => {
	const headersArb = fc.dictionary(
		fc.string({ minLength: 1, maxLength: 50 }),
		fc.string(),
	);
	await fc.assert(
		fc.asyncProperty(headersArb, async (headers) => {
			const event = { headers: { ...headers } };
			const result = await handler(event, defaultContext);
			for (const key of Object.keys(result.headers)) {
				strictEqual(key, key.toLowerCase());
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz header values are preserved after normalization", async () => {
	const headersArb = fc.dictionary(
		fc.string({ minLength: 1, maxLength: 50 }),
		fc.string(),
	);
	await fc.assert(
		fc.asyncProperty(headersArb, async (headers) => {
			const event = { headers: { ...headers } };
			const result = await handler(event, defaultContext);
			const originalValues = new Set(Object.values(headers));
			for (const value of Object.values(result.headers)) {
				strictEqual(originalValues.has(value), true);
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});
