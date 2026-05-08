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

test("fuzz `event` w/ SQS Records", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				Records: fc.array(
					fc.record({
						body: fc.json(),
						messageId: fc.string(),
						eventSource: fc.constant("aws:sqs"),
					}),
					{ minLength: 1 },
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
