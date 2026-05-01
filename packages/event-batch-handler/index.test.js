import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";
import eventBatchResponse from "../event-batch-response/index.js";
import eventBatchHandler from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const sqsEvent = (...records) => ({
	eventSource: "aws:sqs",
	Records: records.map((r, idx) => ({
		messageId: r.messageId ?? String.fromCharCode(97 + idx),
		...r,
	})),
});

test("walks event.Records[] (SQS / Kinesis / DynamoDB)", async () => {
	const handler = eventBatchHandler((record) => record.id);
	const result = await handler(sqsEvent({ id: 1 }, { id: 2 }), defaultContext);
	deepStrictEqual(result, [
		{ status: "fulfilled", value: 1 },
		{ status: "fulfilled", value: 2 },
	]);
});

test("walks event.records[] as Firehose array", async () => {
	const handler = eventBatchHandler((record) => record.recordId);
	const result = await handler(
		{
			deliveryStreamArn: "arn",
			records: [{ recordId: "a" }, { recordId: "b" }],
		},
		defaultContext,
	);
	deepStrictEqual(result, [
		{ status: "fulfilled", value: "a" },
		{ status: "fulfilled", value: "b" },
	]);
});

test("walks event.records (Kafka object keyed by topic-partition)", async () => {
	const handler = eventBatchHandler((message) => message.offset);
	const result = await handler(
		{
			eventSource: "aws:kafka",
			records: {
				"t-0": [
					{ topic: "t", partition: 0, offset: 1 },
					{ topic: "t", partition: 0, offset: 2 },
				],
				"t-1": [{ topic: "t", partition: 1, offset: 5 }],
			},
		},
		defaultContext,
	);
	deepStrictEqual(result, [
		{ status: "fulfilled", value: 1 },
		{ status: "fulfilled", value: 2 },
		{ status: "fulfilled", value: 5 },
	]);
});

test("walks event.tasks[] (S3 Batch)", async () => {
	const handler = eventBatchHandler((task) => task.taskId);
	const result = await handler(
		{
			invocationSchemaVersion: "1.0",
			invocationId: "i",
			tasks: [{ taskId: "a" }, { taskId: "b" }],
		},
		defaultContext,
	);
	deepStrictEqual(result, [
		{ status: "fulfilled", value: "a" },
		{ status: "fulfilled", value: "b" },
	]);
});

test("converts thrown errors to rejected entries", async () => {
	const handler = eventBatchHandler((record) => {
		if (record.fail) throw new Error(`bad ${record.id}`);
		return record.id;
	});
	const result = await handler(
		sqsEvent({ id: 1 }, { id: 2, fail: true }),
		defaultContext,
	);
	strictEqual(result.length, 2);
	strictEqual(result[0].status, "fulfilled");
	strictEqual(result[0].value, 1);
	strictEqual(result[1].status, "rejected");
	strictEqual(result[1].reason.message, "bad 2");
});

test("passes context through to the record handler", async () => {
	const seen = [];
	const handler = eventBatchHandler((record, context) => {
		seen.push(context.getRemainingTimeInMillis());
		return record;
	});
	await handler(sqsEvent({}, {}), defaultContext);
	deepStrictEqual(seen, [1000, 1000]);
});

test("returns [] for missing / non-object events", async () => {
	const handler = eventBatchHandler(() => "x");
	deepStrictEqual(await handler({}, defaultContext), []);
	deepStrictEqual(await handler(null, defaultContext), []);
	deepStrictEqual(await handler(undefined, defaultContext), []);
});

// --- Durable Functions auto-detection ----------------------------------

class DurableContextImpl {
	constructor() {
		this.getRemainingTimeInMillis = () => 1000;
		this.stepCalls = [];
	}
	async step(id, fn) {
		this.stepCalls.push(id);
		// Mirror the SDK: each step's callback receives a per-step child
		// context. We model it as a distinct object that still exposes
		// `step`/`map`-shaped methods so the user can nest sub-steps.
		const stepCtx = Object.create(this);
		stepCtx.parentStepId = id;
		return fn(stepCtx);
	}
}

test("durable context: each record runs in its own ctx.step keyed by index", async () => {
	const ctx = new DurableContextImpl();
	const handler = eventBatchHandler(async (record) => record.id * 2);

	const result = await handler(sqsEvent({ id: 1 }, { id: 2 }, { id: 3 }), ctx);

	deepStrictEqual(result, [
		{ status: "fulfilled", value: 2 },
		{ status: "fulfilled", value: 4 },
		{ status: "fulfilled", value: 6 },
	]);
	deepStrictEqual(ctx.stepCalls, ["record-0", "record-1", "record-2"]);
});

test("durable context: per-record throws propagate (rethrown after Promise.allSettled)", async () => {
	const ctx = new DurableContextImpl();
	const error = new Error("nope");
	const handler = eventBatchHandler(async (record) => {
		if (record.fail) throw error;
		return record.id;
	});

	let caught;
	try {
		await handler(sqsEvent({ id: 1 }, { id: 2, fail: true }), ctx);
	} catch (e) {
		caught = e;
	}
	strictEqual(caught, error);
});

test("durable context: passes the per-step child context (not the parent) to record handler", async () => {
	const ctx = new DurableContextImpl();
	const received = [];
	const handler = eventBatchHandler(async (record, c) => {
		received.push(c);
		return record;
	});

	await handler(sqsEvent({ id: 1 }, { id: 2 }), ctx);
	strictEqual(received.length, 2);
	// Each record handler invocation receives a distinct child context,
	// scoped to the per-record step, not the outer durable context.
	strictEqual(received[0] !== ctx, true);
	strictEqual(received[1] !== ctx, true);
	strictEqual(received[0] !== received[1], true);
	strictEqual(received[0].parentStepId, "record-0");
	strictEqual(received[1].parentStepId, "record-1");
});

test("durable context: nested ctx.step calls inside recordHandler scope under the parent step", async () => {
	const ctx = new DurableContextImpl();
	const handler = eventBatchHandler(async (record, c) => {
		// Nest a sub-step. The mock doesn't track call order beyond stepCalls,
		// so we just confirm it runs and returns its value.
		return c.step(`enrich-${record.id}`, async () => record.id * 10);
	});

	const result = await handler(sqsEvent({ id: 1 }, { id: 2 }), ctx);

	deepStrictEqual(result, [
		{ status: "fulfilled", value: 10 },
		{ status: "fulfilled", value: 20 },
	]);
	// Order interleaves because steps run concurrently — what matters is that
	// every per-record step *and* its nested sub-step appear, demonstrating
	// the nested step ran under a context whose `step` recorded onto the same
	// durable execution.
	deepStrictEqual([...ctx.stepCalls].sort(), [
		"enrich-1",
		"enrich-2",
		"record-0",
		"record-1",
	]);
});

test("durable context: end-to-end through middy + event-batch-response on success", async () => {
	const ctx = new DurableContextImpl();
	const lambda = middy()
		.use(eventBatchResponse())
		.handler(eventBatchHandler(async (record) => record.id));

	const response = await lambda(sqsEvent({ id: 1 }, { id: 2 }), ctx);
	deepStrictEqual(response, { batchItemFailures: [] });
});

test("durable context: end-to-end failure propagates past event-batch-response onError no-op", async () => {
	const ctx = new DurableContextImpl();
	const error = new Error("durable-step-exhausted");
	const lambda = middy()
		.use(eventBatchResponse())
		.handler(
			eventBatchHandler(async (record) => {
				if (record.fail) throw error;
				return record.id;
			}),
		);

	let caught;
	try {
		await lambda(sqsEvent({ id: 1 }, { id: 2, fail: true }), ctx);
	} catch (e) {
		caught = e;
	}
	strictEqual(caught, error);
});

test("integrates with middy + event-batch-response (non-durable)", async () => {
	const lambda = middy()
		.use(eventBatchResponse())
		.handler(
			eventBatchHandler((record) => {
				if (record.fail) throw new Error("boom");
				return record.id;
			}),
		);

	const response = await lambda(
		sqsEvent(
			{ messageId: "ok-1", id: 1 },
			{ messageId: "fail-2", id: 2, fail: true },
		),
		defaultContext,
	);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: "fail-2" }],
	});
});
