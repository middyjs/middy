import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";
import { transpileSchema } from "./transpile.js";

const eventSchema = transpileSchema({
	type: "object",
	properties: {},
	maxProperties: 1,
});
const handler = middy((event) => event).use(middleware({ eventSchema }));
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/validator") {
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

test("fuzz valid objects pass schema validation", async () => {
	const schema = transpileSchema({
		type: "object",
		properties: { name: { type: "string" } },
		additionalProperties: false,
	});
	const validHandler = middy((event) => event).use(
		middleware({ eventSchema: schema }),
	);
	await fc.assert(
		fc.asyncProperty(fc.record({ name: fc.string() }), async (event) => {
			const result = await validHandler(event, defaultContext);
			strictEqual(result.name, event.name);
		}),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz invalid objects throw 400", async () => {
	const schema = transpileSchema({
		type: "object",
		required: ["name"],
		properties: { name: { type: "string" } },
	});
	const strictHandler = middy((event) => event).use(
		middleware({ eventSchema: schema }),
	);
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				name: fc.dictionary(fc.string(), fc.string(), {
					minKeys: 1,
					maxKeys: 3,
				}),
			}),
			async (event) => {
				try {
					await strictHandler(event, defaultContext);
					throw new Error("Expected validation error");
				} catch (e) {
					if (e.cause?.package !== "@middy/validator") throw e;
					strictEqual(e.statusCode, 400);
				}
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});
