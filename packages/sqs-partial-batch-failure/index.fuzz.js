import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const handler = middy((event) => event).use(middleware({ logger: false }));
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
				Records: fc.array(fc.object()),
				response: fc.array(
					fc.record({
						status: fc.constantFrom("pending", "fulfilled", "rejected"),
						reason: fc.string(),
					}),
				),
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

test("fuzz batchItemFailures only contains record messageIds", async () => {
	const records = fc.array(fc.record({ messageId: fc.uuid() }), {
		minLength: 1,
		maxLength: 10,
	});
	const sqsHandler = middy((event) =>
		event.Records.map(() => ({ status: "fulfilled" })),
	).use(middleware({ logger: false }));
	await fc.assert(
		fc.asyncProperty(records, async (Records) => {
			const result = await sqsHandler({ Records }, defaultContext);
			strictEqual(Array.isArray(result.batchItemFailures), true);
			strictEqual(result.batchItemFailures.length, 0);
		}),
		{ numRuns: 100_000, examples: [] },
	);
});
