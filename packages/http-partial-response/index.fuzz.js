import { ok } from "node:assert/strict";
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

			examples: [],
		},
	);
});

test("fuzz filtered body is subset of original", async () => {
	const filterHandler = middy(() => ({
		statusCode: 200,
		body: JSON.stringify({ a: 1, b: 2, c: 3 }),
	})).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom("a", "b", "c", "a,b", "b,c", "a,b,c"),
			async (fields) => {
				const event = { queryStringParameters: { fields } };
				const result = await filterHandler(event, defaultContext);
				const body = JSON.parse(result.body);
				for (const key of Object.keys(body)) {
					ok(fields.includes(key));
				}
			},
		),
		{
			numRuns: 100_000,

			examples: [],
		},
	);
});
