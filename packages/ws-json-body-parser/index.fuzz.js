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
			verbose: 2,

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
			verbose: 2,

			examples: [],
		},
	);
});
