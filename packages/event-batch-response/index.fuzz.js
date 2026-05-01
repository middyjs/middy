import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware, { flattenBatchRecords } from "./index.js";

const handler = middy((event) => event).use(middleware());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz typed-but-malformed events do not crash", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				eventSource: fc.constantFrom(
					"aws:sqs",
					"aws:kinesis",
					"aws:dynamodb",
					"aws:kafka",
					"SelfManagedKafka",
					"aws:lambda:events",
				),
				Records: fc.option(fc.anything()),
				records: fc.option(fc.anything()),
				tasks: fc.option(fc.anything()),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz `event` w/ random Records", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({ Records: fc.array(fc.object()) }),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

const fulfilledHandler = (event) =>
	flattenBatchRecords(event).map(() => ({ status: "fulfilled" }));

test("fuzz SQS records produce empty batchItemFailures when all fulfilled", async () => {
	const sqs = middy((event) => fulfilledHandler(event)).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.record({ messageId: fc.uuid() }), {
				minLength: 1,
				maxLength: 10,
			}),
			async (Records) => {
				const result = await sqs(
					{ eventSource: "aws:sqs", Records },
					defaultContext,
				);
				strictEqual(result.batchItemFailures.length, 0);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Kinesis records produce empty batchItemFailures when all fulfilled", async () => {
	const kinesis = middy((event) => fulfilledHandler(event)).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({ kinesis: fc.record({ sequenceNumber: fc.string() }) }),
				{ minLength: 1, maxLength: 10 },
			),
			async (Records) => {
				const result = await kinesis(
					{ eventSource: "aws:kinesis", Records },
					defaultContext,
				);
				strictEqual(result.batchItemFailures.length, 0);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz DynamoDB records produce empty batchItemFailures when all fulfilled", async () => {
	const dynamo = middy((event) => fulfilledHandler(event)).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({ dynamodb: fc.record({ SequenceNumber: fc.string() }) }),
				{ minLength: 1, maxLength: 10 },
			),
			async (Records) => {
				const result = await dynamo(
					{ eventSource: "aws:dynamodb", Records },
					defaultContext,
				);
				strictEqual(result.batchItemFailures.length, 0);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz S3 Batch tasks produce per-task Succeeded results when all fulfilled", async () => {
	const s3 = middy((event) => fulfilledHandler(event)).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.array(fc.record({ taskId: fc.string(), s3Key: fc.string() }), {
				minLength: 1,
				maxLength: 10,
			}),
			async (tasks) => {
				const result = await s3(
					{
						invocationSchemaVersion: "1.0",
						invocationId: "x",
						job: { id: "j" },
						tasks,
					},
					defaultContext,
				);
				strictEqual(result.results.length, tasks.length);
				strictEqual(
					result.results.every((r) => r.resultCode === "Succeeded"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Firehose records produce per-record Ok when all fulfilled", async () => {
	const firehose = middy((event) => fulfilledHandler(event)).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.array(
				fc.record({
					recordId: fc.string(),
					data: fc.base64String({ minLength: 4, maxLength: 12 }),
				}),
				{ minLength: 1, maxLength: 10 },
			),
			async (records) => {
				const result = await firehose(
					{
						deliveryStreamArn: "arn",
						invocationId: "x",
						records,
					},
					defaultContext,
				);
				strictEqual(result.records.length, records.length);
				strictEqual(
					result.records.every((r) => r.result === "Ok"),
					true,
				);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});

test("fuzz Kafka records produce empty batchItemFailures when all fulfilled", async () => {
	const kafka = middy((event) => fulfilledHandler(event)).use(middleware());
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
					{ minLength: 1, maxLength: 5 },
				),
				{ minKeys: 1, maxKeys: 4 },
			),
			async (records) => {
				const result = await kafka(
					{ eventSource: "aws:kafka", records },
					defaultContext,
				);
				strictEqual(result.batchItemFailures.length, 0);
			},
		),
		{ numRuns: 100_000, examples: [] },
	);
});
