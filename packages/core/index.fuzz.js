import { test } from "node:test";
import fc from "fast-check";
import middy from "./index.js";

const handler = middy((event) => event);
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, context);
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
