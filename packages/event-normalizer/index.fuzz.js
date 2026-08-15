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
			numRuns: 10_000,

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
				// Clone: the middleware normalizes the event in place, so a shared
				// reference would let one fast-check run mutate a later run's input.
				try {
					await handler(structuredClone(event), defaultContext);
				} catch (e) {
					// A prototype-pollution body is rejected with our own 422; that is
					// intended, so only unexpected errors should fail the property.
					if (e.cause?.package !== "@middy/event-normalizer") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 10_000,

			// SQS body is an arbitrary string; the JSON literal `null` parses to
			// `null`, which must not be dereferenced as an SNS notification.
			examples: [
				[
					{
						Records: [{ body: "null", messageId: "", eventSource: "aws:sqs" }],
					},
				],
			],
		},
	);
});
