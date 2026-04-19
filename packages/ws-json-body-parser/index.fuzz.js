import { deepStrictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import jsonBodyParser from "./index.js";

const handler = middy((event) => event).use(jsonBodyParser());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/ws-json-body-parser") {
					throw e;
				}
			}
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				body: fc.string(),
			}),
			async (event) => {
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/ws-json-body-parser") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});

test("fuzz roundtrip: valid JSON body is parsed correctly", async () => {
	await fc.assert(
		fc.asyncProperty(fc.json(), async (jsonStr) => {
			const event = { body: jsonStr };
			const result = await handler(event, defaultContext);
			deepStrictEqual(result.body, JSON.parse(jsonStr));
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});
