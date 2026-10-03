// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { flattenBatchRecords } from "@middy/event-batch-response";
import { isExecutionModeDurable } from "@middy/util";

const pkg = "@middy/event-batch-handler";
// Set by @middy/event-batch-parser on a record whose payload failed to parse.
const parseErrorKey = Symbol.for("@middy/event-batch-parser/error");

const eventBatchHandler = (recordHandler) => async (event, context) => {
	const records = flattenBatchRecords(event);

	if (isExecutionModeDurable(context)) {
		const step = (record, idx) => {
			if (record?.[parseErrorKey]) return Promise.reject(record[parseErrorKey]);
			try {
				return context.step(`record-${idx}`, async (stepCtx) =>
					recordHandler(record, stepCtx),
				);
			} catch (err) {
				return Promise.reject(err);
			}
		};
		const fifo = isFifo(records);
		const settled = fifo
			? await settleSequential(records, step)
			: await Promise.allSettled(records.map(step));
		// A step that failed has used up its durable retries, so the first one
		// fails the invocation. A record that failed to parse never ran a step:
		// durable can't retry it and a replay fails it the same way, so it is
		// left in the settled result to be reported per record. In FIFO the
		// records after it were never run and are reported with it.
		for (let idx = 0; idx < settled.length; idx += 1) {
			if (settled[idx].status === "fulfilled") continue;
			if (!records[idx]?.[parseErrorKey]) throw settled[idx].reason;
			if (fifo) break;
		}
		return settled;
	}

	// Call recordHandler directly and pass its return (promise or value) straight
	// to allSettled. Wrapping each call in `async (record) => …` would allocate an
	// extra promise and add a microtask hop per record; the try/catch keeps the
	// sync-throw safety that wrapper provided without that per-record overhead.
	const settle = (record) => {
		if (record?.[parseErrorKey]) return Promise.reject(record[parseErrorKey]);
		try {
			return recordHandler(record, context);
		} catch (err) {
			return Promise.reject(err);
		}
	};
	if (isFifo(records)) return settleSequential(records, settle);
	return Promise.allSettled(records.map(settle));
};

// FIFO: "your function should stop processing messages after the first
// failure and return all failed and unprocessed messages in
// batchItemFailures". FIFO queue names must end in `.fifo`.
// docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
const isFifo = (records) =>
	records[0]?.eventSource === "aws:sqs" &&
	records[0].eventSourceARN?.endsWith(".fifo") === true;

// Runs records one at a time in order. After the first rejection every
// remaining record settles as rejected without being processed.
const settleSequential = async (records, run) => {
	const settled = new Array(records.length);
	let idx = 0;
	for (; idx < records.length; idx += 1) {
		try {
			settled[idx] = {
				status: "fulfilled",
				value: await run(records[idx], idx),
			};
		} catch (reason) {
			settled[idx] = { status: "rejected", reason };
			break;
		}
	}
	const unprocessed = new Error("Unprocessed: an earlier FIFO record failed", {
		cause: { package: pkg },
	});
	for (idx += 1; idx < records.length; idx += 1) {
		settled[idx] = { status: "rejected", reason: unprocessed };
	}
	return settled;
};

export default eventBatchHandler;
