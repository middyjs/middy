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

test("fuzz returns 'warmup' when warming up", async () => {
	const warmHandler = middy(() => "result").use(
		middleware({ isWarmingUp: () => true }),
	);
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			const result = await warmHandler(event, defaultContext);
			strictEqual(result, "warmup");
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
