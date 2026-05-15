import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import eventBatchHandler from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object` does not throw", async () => {
	const handler = eventBatchHandler(async (record) => record);
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz SQS-shaped events: result length matches Records length", async () => {
	const handler = eventBatchHandler(async (record) => record.messageId);
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.record({ messageId: fc.uuid() }), {
				minLength: 0,
				maxLength: 10,
			}),
			async (Records) => {
				const result = await handler(
					{ eventSource: "aws:sqs", Records },
					defaultContext,
				);
				strictEqual(result.length, Records.length);
				strictEqual(
					result.every((r) => r.status === "fulfilled"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Kinesis-shaped events: result length matches Records length", async () => {
	const handler = eventBatchHandler(
		async (record) => record.kinesis?.sequenceNumber,
	);
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({ kinesis: fc.record({ sequenceNumber: fc.string() }) }),
				{
					minLength: 0,
					maxLength: 10,
				},
			),
			async (Records) => {
				const result = await handler(
					{ eventSource: "aws:kinesis", Records },
					defaultContext,
				);
				strictEqual(result.length, Records.length);
				strictEqual(
					result.every((r) => r.status === "fulfilled"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz DynamoDB-shaped events: result length matches Records length", async () => {
	const handler = eventBatchHandler(
		async (record) => record.dynamodb?.SequenceNumber,
	);
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({ dynamodb: fc.record({ SequenceNumber: fc.string() }) }),
				{
					minLength: 0,
					maxLength: 10,
				},
			),
			async (Records) => {
				const result = await handler(
					{ eventSource: "aws:dynamodb", Records },
					defaultContext,
				);
				strictEqual(result.length, Records.length);
				strictEqual(
					result.every((r) => r.status === "fulfilled"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz S3 Batch-shaped events: result length matches tasks length", async () => {
	const handler = eventBatchHandler(async (task) => task.taskId);
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.record({ taskId: fc.string(), s3Key: fc.string() }), {
				minLength: 0,
				maxLength: 10,
			}),
			async (tasks) => {
				const result = await handler(
					{ invocationSchemaVersion: "1.0", invocationId: "x", tasks },
					defaultContext,
				);
				strictEqual(result.length, tasks.length);
				strictEqual(
					result.every((r) => r.status === "fulfilled"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Firehose-shaped events: result length matches records length", async () => {
	const handler = eventBatchHandler(async (record) => record.recordId);
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({
					recordId: fc.string(),
					data: fc.base64String({ minLength: 4, maxLength: 12 }),
				}),
				{ minLength: 0, maxLength: 10 },
			),
			async (records) => {
				const result = await handler(
					{ deliveryStreamArn: "arn", records },
					defaultContext,
				);
				strictEqual(result.length, records.length);
				strictEqual(
					result.every((r) => r.status === "fulfilled"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Kafka-shaped events: result length matches flattened messages", async () => {
	const handler = eventBatchHandler(async (m) => m.offset);
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(
				fc.string({ minLength: 1, maxLength: 8 }),
				fc.array(
					fc.record({
						topic: fc.string(),
						partition: fc.integer({ min: 0, max: 99 }),
						offset: fc.integer({ min: 0 }),
					}),
					{ minLength: 0, maxLength: 5 },
				),
				{ minKeys: 1, maxKeys: 4 },
			),
			async (records) => {
				const expectedLen = Object.values(records).reduce(
					(n, arr) => n + arr.length,
					0,
				);
				const result = await handler(
					{ eventSource: "aws:kafka", records },
					defaultContext,
				);
				strictEqual(result.length, expectedLen);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});
