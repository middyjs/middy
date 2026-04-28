import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware, { parseJson } from "./index.js";

const handler = middy((event) => event).use(
	middleware({ value: parseJson(), disableEventSourceError: true }),
);
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (_e) {}
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});
