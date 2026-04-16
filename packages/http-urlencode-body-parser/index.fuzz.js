import { strictEqual } from "node:assert/strict";
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
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/http-urlencode-body-parser") {
					throw e;
				}
			}
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
				headers: fc.record({
					"content-type": fc.constant("application/x-www-form-urlencoded"),
				}),
				body: fc.string(),
			}),
			async (event) => {
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-urlencode-body-parser") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz roundtrip: valid urlencoded body parsed correctly", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(
				fc
					.string({ minLength: 1, maxLength: 20 })
					.filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
				fc.string({ maxLength: 50 }),
			),
			async (obj) => {
				const body = new URLSearchParams(obj).toString();
				if (!body) return; // skip empty
				const event = {
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
					body,
				};
				const result = await handler(event, defaultContext);
				for (const [key, value] of Object.entries(obj)) {
					strictEqual(result.body[key], value);
				}
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
