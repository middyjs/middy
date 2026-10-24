// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { flattenBatchRecords } from "@middy/event-batch-response";
import { isExecutionModeDurable, validateOptions } from "@middy/util";

const pkg = "@middy/event-batch-handler";
// Set by @middy/event-batch-parser on a record whose payload failed to parse.
const parseErrorKey = Symbol.for("@middy/event-batch-parser/error");

const optionSchema = {
	type: "object",
	properties: {
		concurrency: { type: "integer", minimum: 1 },
	},
	additionalProperties: false,
};

export const eventBatchHandlerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventBatchHandler = (recordHandler, opts = {}) => {
	eventBatchHandlerValidateOptions(opts);
	// Unset runs every record at once: on Lambda the trigger's BatchSize bounds
	// the batch, a long-running poller (@middy/ecs-batch) has no such bound.
	const concurrency = opts.concurrency ?? Number.POSITIVE_INFINITY;

	return async (event, context) => {
		const records = flattenBatchRecords(event);

		if (isExecutionModeDurable(context)) {
			const step = (record, idx) => {
				if (record?.[parseErrorKey])
					return Promise.reject(record[parseErrorKey]);
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
				: await settleConcurrent(records, step, concurrency);
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
		return settleConcurrent(records, settle, concurrency);
	};
};

// FIFO: "your function should stop processing messages after the first
// failure and return all failed and unprocessed messages in
// batchItemFailures". FIFO queue names must end in `.fifo`.
// docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
const isFifo = (records) =>
	records[0]?.eventSource === "aws:sqs" &&
	records[0].eventSourceARN?.endsWith(".fifo") === true;

// Runs at most `limit` records at once, settled entries stay in record order.
// A batch within the limit takes the plain allSettled path.
const settleConcurrent = async (records, run, limit) => {
	if (records.length <= limit) return Promise.allSettled(records.map(run));
	// Stryker disable next-line ArrayDeclaration: preallocation only, workers assign every index before return
	const settled = new Array(records.length);
	let next = 0;
	const worker = async () => {
		while (next < records.length) {
			const idx = next;
			next += 1;
			try {
				settled[idx] = {
					status: "fulfilled",
					value: await run(records[idx], idx),
				};
			} catch (reason) {
				settled[idx] = { status: "rejected", reason };
			}
		}
	};
	await Promise.all(Array.from({ length: limit }, worker));
	return settled;
};

// Runs records one at a time in order. After the first rejection every
// remaining record settles as rejected without being processed.
const settleSequential = async (records, run) => {
	const settled = [];
	let idx = 0;
	for (; idx < records.length; idx += 1) {
		try {
			settled.push({
				status: "fulfilled",
				value: await run(records[idx], idx),
			});
		} catch (reason) {
			settled.push({ status: "rejected", reason });
			break;
		}
	}
	const unprocessed = new Error("Unprocessed: an earlier FIFO record failed", {
		cause: { package: pkg },
	});
	for (idx += 1; idx < records.length; idx += 1) {
		settled.push({ status: "rejected", reason: unprocessed });
	}
	return settled;
};

export default eventBatchHandler;
