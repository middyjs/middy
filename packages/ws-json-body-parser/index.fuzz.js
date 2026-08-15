import { deepStrictEqual, rejects, strictEqual } from "node:assert/strict";
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
			numRuns: 10_000,
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
			numRuns: 10_000,
			examples: [],
		},
	);
});

test("fuzz roundtrip: valid JSON body is parsed correctly", async () => {
	// The parser rejects prototype-pollution payloads (an own `__proto__` key,
	// or a `constructor` whose value carries a `prototype` member) at any depth
	// with a 422, so the expected outcome is either a clean roundtrip or a 422.
	const isPollution = (jsonStr) => {
		let found = false;
		JSON.parse(jsonStr, (key, value) => {
			if (
				key === "__proto__" ||
				(key === "constructor" && value && Object.hasOwn(value, "prototype"))
			) {
				found = true;
			}
			return value;
		});
		return found;
	};
	await fc.assert(
		fc.asyncProperty(fc.json(), async (jsonStr) => {
			const event = { body: jsonStr };
			if (isPollution(jsonStr)) {
				await rejects(handler(event, defaultContext), (e) => {
					strictEqual(e.statusCode, 422);
					return true;
				});
			} else {
				const result = await handler(event, defaultContext);
				deepStrictEqual(result.body, JSON.parse(jsonStr));
			}
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});
