import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

// Without a serializer the loop never runs, so nothing is exercised.
const handler = middy((event) => event).use(
	middleware({
		serializers: [
			{
				regex: /^application\/json$/,
				serializer: ({ body }) => JSON.stringify(body),
			},
		],
		defaultContentType: "application/json",
	}),
);
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			const response = await handler(event, defaultContext);
			if (response.headers["Content-Type"] === "application/json") {
				strictEqual(typeof response.body, "string");
			}
		}),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});
