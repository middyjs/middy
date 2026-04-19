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

			examples: [],
		},
	);
});

test("fuzz queryStringParameters and pathParameters are always defined", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				httpMethod: fc.constant("GET"),
				path: fc.constant("/"),
				queryStringParameters: fc.oneof(
					fc.constant(null),
					fc.constant(undefined),
					fc.object(),
				),
				pathParameters: fc.oneof(
					fc.constant(null),
					fc.constant(undefined),
					fc.object(),
				),
			}),
			async (event) => {
				const result = await handler(event, defaultContext);
				strictEqual(typeof result.queryStringParameters, "object");
				strictEqual(typeof result.pathParameters, "object");
			},
		),
		{
			numRuns: 100_000,

			examples: [],
		},
	);
});
