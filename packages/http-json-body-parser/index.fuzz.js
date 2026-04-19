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
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/http-json-body-parser") {
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
				headers: fc.record({
					"content-type": fc.constant("application/json"),
				}),
				body: fc.string(),
			}),
			async (event) => {
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-json-body-parser") {
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
			const event = {
				headers: { "content-type": "application/json" },
				body: jsonStr,
			};
			const result = await handler(event, defaultContext);
			deepStrictEqual(result.body, JSON.parse(jsonStr));
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});

test("fuzz invalid JSON always throws 422", async () => {
	const invalidJsonArb = fc.string({ minLength: 1 }).filter((s) => {
		try {
			JSON.parse(s);
			return false;
		} catch {
			return true;
		}
	});
	await fc.assert(
		fc.asyncProperty(invalidJsonArb, async (body) => {
			const event = {
				headers: { "content-type": "application/json" },
				body,
			};
			try {
				await handler(event, defaultContext);
				throw new Error("Expected 422 error");
			} catch (e) {
				strictEqual(e.statusCode, 422);
			}
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});
