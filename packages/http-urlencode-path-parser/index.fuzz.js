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
			await handler(event, defaultContext);
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz decoded path parameters are properly decoded", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(
				fc
					.string({ minLength: 1, maxLength: 10 })
					.filter((s) => /^[a-zA-Z]+$/.test(s)),
				fc.string({ maxLength: 20 }),
			),
			async (params) => {
				const encoded = {};
				for (const [k, v] of Object.entries(params)) {
					encoded[k] = encodeURIComponent(v);
				}
				const event = { pathParameters: encoded };
				const result = await handler(event, defaultContext);
				if (result.pathParameters) {
					for (const [k, v] of Object.entries(params)) {
						strictEqual(result.pathParameters[k], v);
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
