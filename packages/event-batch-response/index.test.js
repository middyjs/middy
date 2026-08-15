import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import createEvent from "@serverless/event-mocks";

import middy from "../core/index.js";
import eventBatchResponse, { flattenBatchRecords } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const allSettledHandler = (extractFlag) => async (event) => {
	// Walk the same record container the middleware uses, in the same order.
	const records =
		event.Records ?? (event.records ? Object.values(event.records).flat() : []);
	const promises = records.map(async (record) => {
		if (extractFlag(record) === "resolve") return record;
		throw new Error("record");
	});
	return Promise.allSettled(promises);
};

// --- SQS ----------------------------------------------------------------

test("SQS: returns batchItemFailures for rejected records only", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageId: "msg-reject-1",
				messageAttributes: { flag: { stringValue: "reject" } },
				body: "",
			},
			{
				messageId: "msg-resolve-1",
				messageAttributes: { flag: { stringValue: "resolve" } },
				body: "",
			},
		],
	});
	const handler = middy(
		allSettledHandler((r) => r.messageAttributes.flag.stringValue),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "msg-reject-1" }],
	});
});

test("SQS: empty batchItemFailures when all resolve", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageId: "msg-1",
				messageAttributes: { flag: { stringValue: "resolve" } },
				body: "",
			},
		],
	});
	const handler = middy(
		allSettledHandler((r) => r.messageAttributes.flag.stringValue),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

// --- Kinesis ------------------------------------------------------------

test("Kinesis: returns batchItemFailures with sequenceNumber identifiers", async () => {
	const event = createEvent.default("aws:kinesis", {
		Records: [
			{
				eventSource: "aws:kinesis",
				kinesis: {
					sequenceNumber: "seq-reject-1",
					partitionKey: "reject",
				},
			},
			{
				eventSource: "aws:kinesis",
				kinesis: {
					sequenceNumber: "seq-resolve-1",
					partitionKey: "resolve",
				},
			},
		],
	});
	const handler = middy(allSettledHandler((r) => r.kinesis.partitionKey)).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "seq-reject-1" }],
	});
});

// --- DynamoDB Streams ---------------------------------------------------

test("DynamoDB: returns batchItemFailures with SequenceNumber identifiers", async () => {
	const event = createEvent.default("aws:dynamo", {
		Records: [
			{
				eventSource: "aws:dynamodb",
				eventName: "INSERT",
				dynamodb: {
					SequenceNumber: "ddb-reject-1",
					Keys: { flag: { S: "reject" } },
				},
			},
			{
				eventSource: "aws:dynamodb",
				eventName: "INSERT",
				dynamodb: {
					SequenceNumber: "ddb-resolve-1",
					Keys: { flag: { S: "resolve" } },
				},
			},
		],
	});
	const handler = middy(allSettledHandler((r) => r.dynamodb.Keys.flag.S)).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "ddb-reject-1" }],
	});
});

// --- MSK / Self-managed Kafka -------------------------------------------

const kafkaEvent = (eventSource) => ({
	eventSource,
	bootstrapServers: "broker:9092",
	records: {
		"topic-0": [
			{ topic: "topic", partition: 0, offset: 10, key: null, value: "resolve" },
			{ topic: "topic", partition: 0, offset: 11, key: null, value: "reject" },
		],
		"topic-1": [
			{ topic: "topic", partition: 1, offset: 20, key: null, value: "reject" },
			{ topic: "topic", partition: 1, offset: 21, key: null, value: "resolve" },
		],
	},
});

test("Kafka (aws:kafka): returns object itemIdentifier { partition, offset }", async () => {
	// Per docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
	// (PartialBatchResponse), Kafka/MSK REQUIRE an object identifier shaped as
	// { partition: `${topic}-${partition}`, offset: Number(offset) }. A flat
	// string identifier is treated as invalid and the entire batch is retried.
	const event = kafkaEvent("aws:kafka");
	const handler = middy(allSettledHandler((r) => r.value)).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: { partition: "topic-0", offset: 11 } },
			{ itemIdentifier: { partition: "topic-1", offset: 20 } },
		],
	});
});

test("Kafka (SelfManagedKafka): same handling as aws:kafka", async () => {
	const event = kafkaEvent("SelfManagedKafka");
	const handler = middy(allSettledHandler((r) => r.value)).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: { partition: "topic-0", offset: 11 } },
			{ itemIdentifier: { partition: "topic-1", offset: 20 } },
		],
	});
});

// --- S3 Batch Operations -----------------------------------------------

const s3BatchEvent = (tasks) => ({
	invocationSchemaVersion: "1.0",
	invocationId: "inv-123",
	job: { id: "job-1" },
	tasks,
});

test("S3 Batch: returns per-task results with Succeeded / TemporaryFailure", async () => {
	const event = s3BatchEvent([
		{ taskId: "t-ok", s3Key: "a", flag: "resolve" },
		{ taskId: "t-err", s3Key: "b", flag: "reject" },
	]);
	const handler = middy(async (e) =>
		Promise.allSettled(
			e.tasks.map(async (task) => {
				if (task.flag === "resolve") return "ok-string";
				throw new Error("boom");
			}),
		),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		invocationSchemaVersion: "1.0",
		treatMissingKeysAs: "PermanentFailure",
		invocationId: "inv-123",
		results: [
			{ taskId: "t-ok", resultCode: "Succeeded", resultString: "ok-string" },
			{ taskId: "t-err", resultCode: "TemporaryFailure", resultString: "boom" },
		],
	});
});

test("S3 Batch: handler can return explicit { resultCode, resultString }", async () => {
	const event = s3BatchEvent([{ taskId: "t-1", s3Key: "a" }]);
	const handler = middy(async () =>
		Promise.allSettled([
			Promise.resolve({ resultCode: "PermanentFailure", resultString: "nope" }),
		]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: "t-1", resultCode: "PermanentFailure", resultString: "nope" },
	]);
});

test("S3 Batch: onError marks every task TemporaryFailure", async () => {
	const event = s3BatchEvent([
		{ taskId: "a", s3Key: "x" },
		{ taskId: "b", s3Key: "y" },
	]);
	const handler = middy(async () => {
		throw new Error("explode");
	}).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: "a", resultCode: "TemporaryFailure", resultString: "explode" },
		{ taskId: "b", resultCode: "TemporaryFailure", resultString: "explode" },
	]);
});

// --- Kinesis Firehose transform ----------------------------------------

const firehoseEvent = (records) => ({
	invocationId: "inv-fh-1",
	deliveryStreamArn: "arn:aws:firehose:us-east-1:123:deliverystream/x",
	region: "us-east-1",
	records,
});

test("Firehose: fulfilled string → Ok with base64 data; rejected → ProcessingFailed", async () => {
	const event = firehoseEvent([
		{ recordId: "r-ok", data: Buffer.from("input-1").toString("base64") },
		{ recordId: "r-err", data: Buffer.from("input-2").toString("base64") },
	]);
	const handler = middy(async (e) =>
		Promise.allSettled(
			e.records.map(async (record, idx) => {
				if (idx === 0) return "transformed";
				throw new Error("processing failed");
			}),
		),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		records: [
			{
				recordId: "r-ok",
				result: "Ok",
				data: Buffer.from("transformed").toString("base64"),
			},
			{
				recordId: "r-err",
				result: "ProcessingFailed",
				data: event.records[1].data,
			},
		],
	});
});

test("Firehose: encodes Buffer / Uint8Array / object data", async () => {
	const event = firehoseEvent([
		{ recordId: "buf", data: "" },
		{ recordId: "u8", data: "" },
		{ recordId: "obj", data: "" },
		{ recordId: "nul", data: "fallback-input" },
	]);
	const handler = middy(async () =>
		Promise.allSettled([
			Promise.resolve(Buffer.from("buffered")),
			Promise.resolve(new Uint8Array([1, 2, 3, 4])),
			Promise.resolve({ hello: "world" }),
			Promise.resolve(null),
		]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{
			recordId: "buf",
			result: "Ok",
			data: Buffer.from("buffered").toString("base64"),
		},
		{
			recordId: "u8",
			result: "Ok",
			data: Buffer.from([1, 2, 3, 4]).toString("base64"),
		},
		{
			recordId: "obj",
			result: "Ok",
			data: Buffer.from(JSON.stringify({ hello: "world" })).toString("base64"),
		},
		{ recordId: "nul", result: "Ok", data: "fallback-input" },
	]);
});

test("Firehose: { result, data: Buffer } is base64-encoded", async () => {
	const event = firehoseEvent([{ recordId: "x", data: "orig" }]);
	const handler = middy(async () =>
		Promise.allSettled([
			Promise.resolve({ result: "Ok", data: Buffer.from("explicit") }),
		]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{
			recordId: "x",
			result: "Ok",
			data: Buffer.from("explicit").toString("base64"),
		},
	]);
});

test("Firehose: handler can return Dropped via { result, data }", async () => {
	const event = firehoseEvent([
		{ recordId: "r-drop", data: Buffer.from("x").toString("base64") },
	]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve({ result: "Dropped", data: "" })]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{ recordId: "r-drop", result: "Dropped", data: "" },
	]);
});

// --- Detection / fallbacks ---------------------------------------------

test("detects eventSource from first record when missing on event", async () => {
	// SQS-like event with no top-level eventSource.
	const event = {
		Records: [
			{
				eventSource: "aws:sqs",
				messageId: "msg-x",
				messageAttributes: { flag: { stringValue: "reject" } },
				body: "",
			},
		],
	};
	const handler = middy(
		allSettledHandler((r) => r.messageAttributes.flag.stringValue),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "msg-x" }],
	});
});

test("unknown eventSource: leaves response untouched", async () => {
	const event = { Records: [{ eventSource: "aws:unknown", id: "x" }] };
	const handler = middy(async () => ({ pass: true })).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { pass: true });
});

test("missing Records / records / events: no-op", async () => {
	const event = {};
	const handler = middy(async () => ({ pass: true })).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { pass: true });
});

test("non-object event: no-op", async () => {
	const handler = middy(async () => null).use(eventBatchResponse());

	const response = await handler(null, defaultContext);
	strictEqual(response, null);
});

test("empty Records array: detection falls through, no-op", async () => {
	const event = { Records: [] };
	const handler = middy(async () => ({ kept: true })).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { kept: true });
});

test("non-array handler response is left untouched (contract violation surfaces)", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [{ messageId: "x", body: "" }],
	});
	const handler = middy(async () => ({ not: "an array" })).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { not: "an array" });
});

test("S3 Batch: rejected with non-Error reason uses its string form", async () => {
	const event = s3BatchEvent([{ taskId: "t", s3Key: "k" }]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.reject("plain-string-reason")]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{
			taskId: "t",
			resultCode: "TemporaryFailure",
			resultString: "plain-string-reason",
		},
	]);
});

test("S3 Batch: rejected with no reason yields empty resultString", async () => {
	const event = s3BatchEvent([{ taskId: "t", s3Key: "k" }]);
	const handler = middy(async () => Promise.allSettled([Promise.reject()])).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: "t", resultCode: "TemporaryFailure", resultString: "" },
	]);
});

test("detects from record.EventSource (capital-E fallback)", async () => {
	const event = {
		Records: [{ EventSource: "aws:sqs", messageId: "z", body: "" }],
	};
	const handler = middy(async () =>
		Promise.allSettled([Promise.reject(new Error("x"))]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "z" }],
	});
});

test("S3 Batch: { resultCode } without resultString defaults to empty string", async () => {
	const event = s3BatchEvent([{ taskId: "t", s3Key: "k" }]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve({ resultCode: "Succeeded" })]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: "t", resultCode: "Succeeded", resultString: "" },
	]);
});

test("Kafka: empty records object yields empty batchItemFailures", async () => {
	const event = { eventSource: "aws:kafka", records: {} };
	const handler = middy(async () => []).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

test("S3 Batch: missing settled entry treated as TemporaryFailure", async () => {
	const event = s3BatchEvent([
		{ taskId: "a", s3Key: "x" },
		{ taskId: "b", s3Key: "y" },
	]);
	// Handler returns one entry for two tasks.
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve("ok")]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: "a", resultCode: "Succeeded", resultString: "ok" },
		{ taskId: "b", resultCode: "TemporaryFailure", resultString: "" },
	]);
});

test("Firehose: missing settled entry treated as ProcessingFailed", async () => {
	const event = firehoseEvent([
		{ recordId: "a", data: "input-a" },
		{ recordId: "b", data: "input-b" },
	]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve("ok")]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{ recordId: "a", result: "Ok", data: Buffer.from("ok").toString("base64") },
		{ recordId: "b", result: "ProcessingFailed", data: "input-b" },
	]);
});

// --- onError ------------------------------------------------------------

test("onError SQS: rejects every record when handler throws", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{ messageId: "a", body: "" },
			{ messageId: "b", body: "" },
		],
	});
	const handler = middy(async () => {
		throw new Error("boom");
	}).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "a" }, { itemIdentifier: "b" }],
	});
});

test("onError Kafka: rejects every flattened message", async () => {
	const event = kafkaEvent("aws:kafka");
	const handler = middy(async () => {
		throw new Error("boom");
	}).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: { partition: "topic-0", offset: 10 } },
			{ itemIdentifier: { partition: "topic-0", offset: 11 } },
			{ itemIdentifier: { partition: "topic-1", offset: 20 } },
			{ itemIdentifier: { partition: "topic-1", offset: 21 } },
		],
	});
});

test("onError preserves a pre-existing response", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [{ messageId: "a", body: "" }],
	});
	const handler = middy(async () => {
		throw new Error("boom");
	})
		.use(eventBatchResponse())
		.onError((request) => {
			request.response = { custom: "kept" };
		});

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { custom: "kept" });
});

test("under durable context, success path produces empty batchItemFailures", async () => {
	class DurableContextImpl {
		[Symbol.for("@aws/durable-execution-sdk-js/durable-context")] = true;
		constructor() {
			this.getRemainingTimeInMillis = () => 1000;
		}
		async step(_id, fn) {
			return fn(this);
		}
		async runInChildContext(_id, fn) {
			return fn(this);
		}
	}
	const event = createEvent.default("aws:sqs", {
		Records: [
			{ messageId: "a", body: "" },
			{ messageId: "b", body: "" },
		],
	});
	const handler = middy(async () => [
		{ status: "fulfilled", value: 1 },
		{ status: "fulfilled", value: 2 },
	]).use(eventBatchResponse());

	const response = await handler(event, new DurableContextImpl());
	deepStrictEqual(response, { batchItemFailures: [] });
});

test("onError under durable context: no-op (durable owns retry)", async () => {
	class DurableContextImpl {
		[Symbol.for("@aws/durable-execution-sdk-js/durable-context")] = true;
		constructor() {
			this.getRemainingTimeInMillis = () => 1000;
		}
		async step(_id, fn) {
			return fn(this);
		}
		async runInChildContext(_id, fn) {
			return fn(this);
		}
	}
	const event = createEvent.default("aws:sqs", {
		Records: [{ messageId: "a", body: "" }],
	});
	const handler = middy(async () => {
		throw new Error("durable-step-exhausted");
	}).use(eventBatchResponse());

	let caught;
	try {
		await handler(event, new DurableContextImpl());
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof Error);
	strictEqual(caught.message, "durable-step-exhausted");
});

test("onError unknown source: does nothing", async () => {
	const event = { Records: [{ eventSource: "aws:unknown" }] };
	const handler = middy(async () => {
		throw new Error("boom");
	}).use(eventBatchResponse());

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof Error);
	strictEqual(caught.message, "boom");
});

// --- flattenBatchRecords (public named export) -------------------------

test("flattenBatchRecords: unknown / null / undefined → []", () => {
	deepStrictEqual(flattenBatchRecords(null), []);
	deepStrictEqual(flattenBatchRecords(undefined), []);
	deepStrictEqual(flattenBatchRecords({}), []);
	deepStrictEqual(
		flattenBatchRecords({ Records: [{ eventSource: "aws:unknown" }] }),
		[],
	);
});

test("flattenBatchRecords: SQS / Kinesis / DynamoDB walk Records", () => {
	const records = [{ messageId: "a" }, { messageId: "b" }];
	deepStrictEqual(
		flattenBatchRecords({ eventSource: "aws:sqs", Records: records }),
		records,
	);
});

test("flattenBatchRecords: Kafka flattens object keyed by topic-partition", () => {
	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ offset: 1 }, { offset: 2 }],
			"t-1": [{ offset: 5 }],
		},
	};
	deepStrictEqual(flattenBatchRecords(event), [
		{ offset: 1 },
		{ offset: 2 },
		{ offset: 5 },
	]);
});

test("flattenBatchRecords: S3 Batch walks tasks", () => {
	const tasks = [{ taskId: "a" }, { taskId: "b" }];
	const event = { invocationSchemaVersion: "1.0", invocationId: "i", tasks };
	deepStrictEqual(flattenBatchRecords(event), tasks);
});

test("flattenBatchRecords: Firehose walks records array", () => {
	const records = [{ recordId: "a" }, { recordId: "b" }];
	deepStrictEqual(
		flattenBatchRecords({ deliveryStreamArn: "arn", records }),
		records,
	);
});

// --- Alignment paranoia: flattenBatchRecords order must match middleware identifiers --

test("flattenBatchRecords order matches the middleware's response identifier order", async () => {
	const cases = [
		{
			name: "SQS",
			event: {
				eventSource: "aws:sqs",
				Records: [
					{ messageId: "m1" },
					{ messageId: "m2" },
					{ messageId: "m3" },
				],
			},
			extractIds: (response) =>
				response.batchItemFailures.map((f) => f.itemIdentifier),
			extractRecordIds: (records) => records.map((r) => r.messageId),
		},
		{
			name: "Kafka",
			event: {
				eventSource: "aws:kafka",
				records: {
					"t-0": [
						{ topic: "t", partition: 0, offset: 1 },
						{ topic: "t", partition: 0, offset: 2 },
					],
					"t-1": [{ topic: "t", partition: 1, offset: 5 }],
				},
			},
			extractIds: (response) =>
				response.batchItemFailures.map((f) => f.itemIdentifier),
			extractRecordIds: (records) =>
				records.map((m) => ({
					partition: `${m.topic}-${m.partition}`,
					offset: Number(m.offset),
				})),
		},
		{
			name: "S3 Batch",
			event: {
				invocationSchemaVersion: "1.0",
				invocationId: "i",
				tasks: [{ taskId: "t1" }, { taskId: "t2" }],
			},
			extractIds: (response) => response.results.map((r) => r.taskId),
			extractRecordIds: (records) => records.map((t) => t.taskId),
		},
		{
			name: "Firehose",
			event: {
				deliveryStreamArn: "arn",
				records: [
					{ recordId: "r1", data: "" },
					{ recordId: "r2", data: "" },
				],
			},
			extractIds: (response) => response.records.map((r) => r.recordId),
			extractRecordIds: (records) => records.map((r) => r.recordId),
		},
	];

	for (const { name, event, extractIds, extractRecordIds } of cases) {
		const flattened = flattenBatchRecords(event);
		// Force every record to fail so every identifier appears in the response.
		const handler = middy(async () =>
			flattened.map(() => ({ status: "rejected", reason: new Error("x") })),
		).use(eventBatchResponse());
		const response = await handler(event, defaultContext);
		deepStrictEqual(
			extractIds(response),
			extractRecordIds(flattened),
			`alignment broken for ${name}`,
		);
	}
});

// --- Malformed events: defensive degradation ----------------------------

test("malformed Kafka event without records → empty response, no crash", async () => {
	const event = { eventSource: "aws:kafka" };
	const handler = middy(async () => []).use(eventBatchResponse());
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

test("malformed Firehose event without records → empty response, no crash", async () => {
	const event = { deliveryStreamArn: "arn" };
	const handler = middy(async () => []).use(eventBatchResponse());
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { records: [] });
});

test("malformed Kafka event with non-array partition → skipped, no crash", async () => {
	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": "not-an-array" },
	};
	const handler = middy(async () => []).use(eventBatchResponse());
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

// --- Empty batches ------------------------------------------------------

test("empty SQS batch → empty batchItemFailures", async () => {
	const event = { eventSource: "aws:sqs", Records: [] };
	const handler = middy(async () => []).use(eventBatchResponse());
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

test("treats missing response entries as rejected", async () => {
	const event = createEvent.default("aws:kinesis", {
		Records: [
			{ eventSource: "aws:kinesis", kinesis: { sequenceNumber: "s-1" } },
			{ eventSource: "aws:kinesis", kinesis: { sequenceNumber: "s-2" } },
		],
	});
	const handler = middy(async () => [{ status: "fulfilled", value: "ok" }]).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "s-2" }],
	});
});

// --- internal cache key -------------------------------------------------

test("stores its cache under request.internal['@middy/event-batch-response']", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [{ messageId: "a", body: "" }],
	});
	let beforeInternal;
	let afterInternal;
	const capture = {
		// runs after eventBatchResponse().before stored the cache
		before: (request) => {
			beforeInternal = request.internal["@middy/event-batch-response"];
		},
		// runs before eventBatchResponse().after consumes the cache
		after: (request) => {
			afterInternal = request.internal["@middy/event-batch-response"];
		},
	};
	const handler = middy(async () => [{ status: "fulfilled", value: 1 }])
		.use(eventBatchResponse())
		.use(capture);

	await handler(event, defaultContext);
	ok(
		beforeInternal,
		"cache must be set under the @middy/event-batch-response key",
	);
	deepStrictEqual(beforeInternal.records, event.Records);
	ok(afterInternal, "cache must still be present when after runs");
});

// --- defensive identify / optional chaining -----------------------------

test("Kafka: settled shorter than records does not throw, extra message is a failure", async () => {
	const event = {
		eventSource: "aws:kafka",
		records: {
			"topic-0": [
				{ topic: "topic", partition: 0, offset: 10 },
				{ topic: "topic", partition: 0, offset: 11 },
			],
		},
	};
	// Only one settled entry for two messages: settled[1] is undefined.
	const handler = middy(async () => [{ status: "fulfilled", value: 1 }]).use(
		eventBatchResponse(),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: { partition: "topic-0", offset: 11 } },
		],
	});
});

test("SQS: null record passed to identify yields undefined, no throw", async () => {
	const event = {
		eventSource: "aws:sqs",
		Records: [{ messageId: "a" }, null],
	};
	const handler = middy(async () => [
		{ status: "rejected", reason: new Error("x") },
		{ status: "rejected", reason: new Error("x") },
	]).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "a" }, { itemIdentifier: undefined }],
	});
});

test("Kinesis: null record and record missing .kinesis yield undefined, no throw", async () => {
	const event = {
		eventSource: "aws:kinesis",
		Records: [null, { eventSource: "aws:kinesis" }],
	};
	const handler = middy(async () => [
		{ status: "rejected", reason: new Error("x") },
		{ status: "rejected", reason: new Error("x") },
	]).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: undefined },
			{ itemIdentifier: undefined },
		],
	});
});

test("DynamoDB: null record and record missing .dynamodb yield undefined, no throw", async () => {
	const event = {
		eventSource: "aws:dynamodb",
		Records: [null, { eventSource: "aws:dynamodb" }],
	};
	const handler = middy(async () => [
		{ status: "rejected", reason: new Error("x") },
		{ status: "rejected", reason: new Error("x") },
	]).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: undefined },
			{ itemIdentifier: undefined },
		],
	});
});

test("S3 Batch: null task passed to identify yields undefined, no throw", async () => {
	const event = s3BatchEvent([null]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.reject(new Error("boom"))]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.results, [
		{ taskId: undefined, resultCode: "TemporaryFailure", resultString: "boom" },
	]);
});

test("Firehose: null record yields undefined identifier/data, no throw", async () => {
	const event = firehoseEvent([{ recordId: "a", data: "in-a" }, null]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve("ok"), Promise.resolve("ok2")]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{ recordId: "a", result: "Ok", data: Buffer.from("ok").toString("base64") },
		{
			recordId: undefined,
			result: "Ok",
			data: Buffer.from("ok2").toString("base64"),
		},
	]);
});

test("Firehose: fulfilled undefined transform result falls back to input data", async () => {
	const event = firehoseEvent([{ recordId: "r", data: "fallback-input" }]);
	const handler = middy(async () =>
		Promise.allSettled([Promise.resolve(undefined)]),
	).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response.records, [
		{ recordId: "r", result: "Ok", data: "fallback-input" },
	]);
});

// --- detection requires BOTH s3:batch signals ---------------------------

test("S3 Batch detection requires both invocationSchemaVersion AND tasks array", async () => {
	// invocationSchemaVersion present, tasks absent: must NOT be treated as
	// s3:batch; detection falls through to the SQS record's eventSource.
	const event = {
		invocationSchemaVersion: "1.0",
		invocationId: "inv-x",
		Records: [{ eventSource: "aws:sqs", messageId: "m", body: "" }],
	};
	const handler = middy(async () => [
		{ status: "rejected", reason: new Error("x") },
	]).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "m" }],
	});
});

// --- Kafka non-object records -------------------------------------------

test("Kafka: non-object truthy records yields empty batchItemFailures", async () => {
	const event = { eventSource: "aws:kafka", records: "not-an-object" };
	const handler = middy(async () => []).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
});

// --- onError synthesized settled entries are "rejected" -----------------

test("onError: every record becomes a failure (synthesized status 'rejected')", async () => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{ messageId: "a", body: "" },
			{ messageId: "b", body: "" },
			{ messageId: "c", body: "" },
		],
	});
	const handler = middy(async () => {
		throw new Error("explode");
	}).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [
			{ itemIdentifier: "a" },
			{ itemIdentifier: "b" },
			{ itemIdentifier: "c" },
		],
	});
});

// --- after runs only when before cached an entry ------------------------

test("after with no cached entry leaves an array response untouched", async () => {
	// Unrecognized source: before stores nothing, so after must early-return
	// even though request.response is an array.
	const event = { Records: [{ eventSource: "aws:unknown", id: "x" }] };
	const settled = [{ status: "rejected", reason: new Error("x") }];
	const handler = middy(async () => settled).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, settled);
});

// --- prototype-pollution-safe source lookup -----------------------------

test("flattenBatchRecords: event-level eventSource matching Object.prototype member → []", () => {
	// A source string equal to an inherited Object.prototype member ("constructor",
	// "__proto__", "toString", "hasOwnProperty", "valueOf") must NOT resolve to a
	// truthy inherited value; the unknown-source contract is a graceful [].
	for (const proto of [
		"constructor",
		"__proto__",
		"toString",
		"hasOwnProperty",
		"valueOf",
	]) {
		deepStrictEqual(
			flattenBatchRecords({
				eventSource: proto,
				Records: [{ messageId: "a" }],
			}),
			[],
			`event-level eventSource "${proto}" must be treated as unknown`,
		);
	}
});

test("flattenBatchRecords: record-level eventSource matching Object.prototype member → []", () => {
	for (const proto of [
		"constructor",
		"__proto__",
		"toString",
		"hasOwnProperty",
		"valueOf",
	]) {
		deepStrictEqual(
			flattenBatchRecords({ Records: [{ eventSource: proto }] }),
			[],
			`record-level eventSource "${proto}" must be treated as unknown`,
		);
	}
});

test("before hook handles eventSource matching Object.prototype member gracefully", async () => {
	const event = { eventSource: "constructor", Records: [{ messageId: "a" }] };
	const handler = middy(async () => ({ pass: true })).use(eventBatchResponse());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { pass: true });
});
