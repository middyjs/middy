import { ok } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const handler = middy((event) => event).use(
	middleware({ failOnMismatch: false }),
);
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

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				headers: fc.record({
					"Accept-Charset": fc.string(),
					"Accept-Encoding": fc.string(),
					"Accept-Language": fc.string(),
					Accept: fc.string(),
				}),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 100_000,

			examples: [],
		},
	);
});

test("fuzz context has preferredMediaType after negotiation", async () => {
	const negHandler = middy((event, context) => ({
		preferredMediaType: context.preferredMediaType,
	})).use(
		middleware({
			availableMediaTypes: ["application/json"],
			failOnMismatch: false,
		}),
	);
	await fc.assert(
		fc.asyncProperty(
			fc.record({ headers: fc.record({ Accept: fc.string() }) }),
			async (event) => {
				const result = await negHandler(event, defaultContext);
				const type = typeof result.preferredMediaType;
				ok(type === "string" || type === "undefined");
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});
