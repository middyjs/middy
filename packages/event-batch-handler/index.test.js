import { deepStrictEqual, rejects, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";

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

describe("@middy/event-batch-handler", () => {
	test("walks event.Records[] (SQS / Kinesis / DynamoDB)", async () => {
		const handler = eventBatchHandler((record) => record.id);
		const result = await handler(
			sqsEvent({ id: 1 }, { id: 2 }),
			defaultContext,
		);
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

	// FIFO: "your function should stop processing messages after the first
	// failure and return all failed and unprocessed messages in
	// batchItemFailures".
	// docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
	const fifoEvent = (...records) => {
		const event = sqsEvent(...records);
		for (const record of event.Records) {
			record.eventSource = "aws:sqs";
			record.eventSourceARN = "arn:aws:sqs:us-east-1:123456789012:q.fifo";
		}
		return event;
	};

	test("FIFO SQS: stops at the first failure and rejects the rest unprocessed", async () => {
		const seen = [];
		const error = new Error("bad 2");
		const handler = eventBatchHandler(async (record) => {
			seen.push(record.id);
			if (record.fail) throw error;
			return record.id;
		});
		const result = await handler(
			fifoEvent({ id: 1 }, { id: 2, fail: true }, { id: 3 }, { id: 4 }),
			defaultContext,
		);
		deepStrictEqual(seen, [1, 2]);
		deepStrictEqual(
			result.map((r) => r.status),
			["fulfilled", "rejected", "rejected", "rejected"],
		);
		strictEqual(result[0].value, 1);
		strictEqual(result[1].reason, error);
		strictEqual(
			result[2].reason.message,
			"Unprocessed: an earlier FIFO record failed",
		);
		strictEqual(result[3].reason, result[2].reason);
	});

	test("FIFO SQS: processes records sequentially, in order", async () => {
		const events = [];
		const handler = eventBatchHandler(async (record) => {
			events.push(`start-${record.id}`);
			await new Promise((resolve) => setTimeout(resolve, 3 - record.id));
			events.push(`end-${record.id}`);
			return record.id;
		});
		const result = await handler(
			fifoEvent({ id: 1 }, { id: 2 }),
			defaultContext,
		);
		deepStrictEqual(events, ["start-1", "end-1", "start-2", "end-2"]);
		deepStrictEqual(result, [
			{ status: "fulfilled", value: 1 },
			{ status: "fulfilled", value: 2 },
		]);
	});

	test("standard SQS: a failure does not stop the remaining records", async () => {
		const seen = [];
		const handler = eventBatchHandler(async (record) => {
			seen.push(record.id);
			if (record.fail) throw new Error("bad");
			return record.id;
		});
		const event = sqsEvent({ id: 1, fail: true }, { id: 2 });
		for (const record of event.Records) {
			record.eventSource = "aws:sqs";
			record.eventSourceARN = "arn:aws:sqs:us-east-1:123456789012:q";
		}
		const result = await handler(event, defaultContext);
		deepStrictEqual(seen, [1, 2]);
		deepStrictEqual(
			result.map((r) => r.status),
			["rejected", "fulfilled"],
		);
	});

	test("FIFO SQS: integrates with event-batch-response (failed + unprocessed reported)", async () => {
		const lambda = middy()
			.use(eventBatchResponse())
			.handler(
				eventBatchHandler((record) => {
					if (record.fail) throw new Error("boom");
					return record.id;
				}),
			);
		const response = await lambda(
			fifoEvent(
				{ messageId: "m1", id: 1 },
				{ messageId: "m2", id: 2, fail: true },
				{ messageId: "m3", id: 3 },
			),
			defaultContext,
		);
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "m2" }, { itemIdentifier: "m3" }],
		});
	});

	// Records that @middy/event-batch-parser failed to parse carry their error
	// under this key.
	const parseErrorKey = Symbol.for("@middy/event-batch-parser/error");

	test("a record carrying a parse error is rejected without calling the record handler", async () => {
		const seen = [];
		const error = new Error("unparseable");
		const handler = eventBatchHandler((record) => {
			seen.push(record.id);
			return record.id;
		});
		const event = sqsEvent({ id: 1 }, { id: 2 }, { id: 3 });
		event.Records[1][parseErrorKey] = error;
		const result = await handler(event, defaultContext);
		deepStrictEqual(seen, [1, 3]);
		deepStrictEqual(result, [
			{ status: "fulfilled", value: 1 },
			{ status: "rejected", reason: error },
			{ status: "fulfilled", value: 3 },
		]);
	});

	test("FIFO SQS: a record carrying a parse error stops processing there", async () => {
		const seen = [];
		const error = new Error("unparseable");
		const handler = eventBatchHandler((record) => {
			seen.push(record.id);
			return record.id;
		});
		const event = fifoEvent({ id: 1 }, { id: 2 }, { id: 3 });
		event.Records[1][parseErrorKey] = error;
		const result = await handler(event, defaultContext);
		deepStrictEqual(seen, [1]);
		strictEqual(result[1].reason, error);
		strictEqual(result[2].status, "rejected");
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

	test("throws for an unsupported eventSource without running a record", async () => {
		let calls = 0;
		const handler = eventBatchHandler(() => {
			calls += 1;
		});
		const event = {
			eventSource: "aws:rmq",
			rmqMessagesByQueue: { "q::/": [{ data: "eA==" }] },
		};
		await rejects(handler(event, defaultContext), {
			message: 'Unsupported event source "aws:rmq"',
		});
		strictEqual(calls, 0);
	});

	// --- Durable Functions auto-detection ----------------------------------

	class DurableContextImpl {
		[Symbol.for("@aws/durable-execution-sdk-js/durable-context")] = true;
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
		async runInChildContext(_id, fn) {
			return fn(Object.create(this));
		}
	}

	test("durable context: each record runs in its own ctx.step keyed by index", async () => {
		const ctx = new DurableContextImpl();
		const handler = eventBatchHandler(async (record) => record.id * 2);

		const result = await handler(
			sqsEvent({ id: 1 }, { id: 2 }, { id: 3 }),
			ctx,
		);

		deepStrictEqual(result, [
			{ status: "fulfilled", value: 2 },
			{ status: "fulfilled", value: 4 },
			{ status: "fulfilled", value: 6 },
		]);
		deepStrictEqual(ctx.stepCalls, ["record-0", "record-1", "record-2"]);
	});

	test("durable context: a synchronous throw from context.step is settled then propagated", async () => {
		const ctx = new DurableContextImpl();
		const error = new Error("step-sync-throw");
		// context.step itself throwing synchronously (not the record handler) must be
		// caught and settled as a rejection (so every record's step is still
		// attempted) rather than escaping Promise.allSettled as a raw sync throw.
		ctx.step = () => {
			throw error;
		};
		const handler = eventBatchHandler(async (record) => record.id);

		let caught;
		try {
			await handler(sqsEvent({ id: 1 }, { id: 2 }), ctx);
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, error);
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

	test("durable context + FIFO SQS: stops stepping at the first failure", async () => {
		const ctx = new DurableContextImpl();
		const error = new Error("nope");
		const handler = eventBatchHandler(async (record) => {
			if (record.fail) throw error;
			return record.id;
		});

		let caught;
		try {
			await handler(
				fifoEvent({ id: 1 }, { id: 2, fail: true }, { id: 3 }),
				ctx,
			);
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, error);
		deepStrictEqual(ctx.stepCalls, ["record-0", "record-1"]);
	});

	test("durable context + FIFO SQS: all records succeed in order", async () => {
		const ctx = new DurableContextImpl();
		const handler = eventBatchHandler(async (record) => record.id);
		const result = await handler(fifoEvent({ id: 1 }, { id: 2 }), ctx);
		deepStrictEqual(result, [
			{ status: "fulfilled", value: 1 },
			{ status: "fulfilled", value: 2 },
		]);
	});

	// A parse error never ran a step, so durable has no retry for it and a
	// replay fails it the same way: it is reported per record instead of
	// failing the invocation (which would redeliver the batch forever).
	test("durable context: a record carrying a parse error is not stepped and is returned as a rejection", async () => {
		const ctx = new DurableContextImpl();
		const error = new Error("unparseable");
		const handler = eventBatchHandler(async (record) => record.id);
		const event = sqsEvent({ id: 1 }, { id: 2 });
		event.Records[1][parseErrorKey] = error;

		const result = await handler(event, ctx);
		deepStrictEqual(result, [
			{ status: "fulfilled", value: 1 },
			{ status: "rejected", reason: error },
		]);
		deepStrictEqual(ctx.stepCalls, ["record-0"]);
	});

	test("durable context: a step failure still propagates when another record has a parse error", async () => {
		const ctx = new DurableContextImpl();
		const stepError = new Error("step-exhausted");
		const handler = eventBatchHandler(async (record) => {
			if (record.fail) throw stepError;
			return record.id;
		});
		const event = sqsEvent({ id: 1 }, { id: 2, fail: true });
		event.Records[0][parseErrorKey] = new Error("unparseable");

		let caught;
		try {
			await handler(event, ctx);
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, stepError);
	});

	test("durable context + FIFO SQS: a parse error stops stepping and the rest are returned unprocessed", async () => {
		const ctx = new DurableContextImpl();
		const error = new Error("unparseable");
		const handler = eventBatchHandler(async (record) => record.id);
		const event = fifoEvent({ id: 1 }, { id: 2 }, { id: 3 });
		event.Records[1][parseErrorKey] = error;

		const result = await handler(event, ctx);
		deepStrictEqual(
			result.map((r) => r.status),
			["fulfilled", "rejected", "rejected"],
		);
		strictEqual(result[1].reason, error);
		strictEqual(
			result[2].reason.message,
			"Unprocessed: an earlier FIFO record failed",
		);
		deepStrictEqual(ctx.stepCalls, ["record-0"]);
	});

	test("durable context: end-to-end, a parse error is reported in batchItemFailures", async () => {
		const ctx = new DurableContextImpl();
		const lambda = middy()
			.use(eventBatchResponse())
			.handler(eventBatchHandler(async (record) => record.id));
		const event = sqsEvent(
			{ messageId: "ok-1", id: 1 },
			{ messageId: "bad-2", id: 2 },
		);
		event.Records[1][parseErrorKey] = new Error("unparseable");

		const response = await lambda(event, ctx);
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "bad-2" }],
		});
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
		// Order interleaves because steps run concurrently, what matters is that
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
});
