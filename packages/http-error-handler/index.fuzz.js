import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import { createError } from "../util/index.js";
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

test("fuzz errors produce valid HTTP response", async () => {
	const errorHandler = middy(() => {
		throw createError(422, "test");
	}).use(middleware({ logger: false }));
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			const result = await errorHandler(event, defaultContext);
			strictEqual(typeof result.statusCode, "number");
			ok(result.statusCode >= 100 && result.statusCode < 600);
		}),
		{ numRuns: 100_000, examples: [] },
	);
});
