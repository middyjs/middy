// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { flattenBatchRecords } from "@middy/event-batch-response";
import { isExecutionModeDurable, validateOptions } from "@middy/util";

const pkg = "@middy/event-batch-handler";
// Set by @middy/event-batch-parser on a record whose payload failed to parse.
const parseErrorKey = Symbol.for("@middy/event-batch-parser/error");

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:event-batch-handler:options",
	type: "object",
	properties: {
		// BatchSize "Valid Range: Minimum value of 1. Maximum value of 10000."
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		concurrency: { type: "integer", minimum: 1, maximum: 10000 },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const eventBatchHandlerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventBatchHandler = (recordHandler, opts = {}) => {
	eventBatchHandlerValidateOptions(opts);
	const concurrency = opts.concurrency ?? Number.POSITIVE_INFINITY;
	const streamsInOrder = opts.concurrency === undefined;

	return async (event, context) => {
		const records = flattenBatchRecords(event);

		if (isExecutionModeDurable(context)) {
			// Each record runs in its own child context, the durable operation
			// that groups other operations, so the record handler gets a durable
			// context and can run steps, waits and invokes of its own. A step
			// callback would get a StepContext (`logger`, `attempt`) instead, in
			// which no durable operation can run.
			const runRecord = (record, idx) => {
				if (record?.[parseErrorKey])
					return Promise.reject(record[parseErrorKey]);
				try {
					return context.runInChildContext(
						`record-${idx}`,
						async (childContext) => recordHandler(record, childContext),
					);
				} catch (err) {
					return Promise.reject(err);
				}
			};
			const ordered = orderedBatchKind(records, streamsInOrder);
			const settled = ordered
				? await settleSequential(records, runRecord, ordered)
				: await settleConcurrent(records, runRecord, concurrency);
			// The durable runtime retries the steps inside a child context, not the
			// child context itself, so one that failed has no retry left and the
			// first one fails the invocation. A record that failed to parse never
			// ran: a replay fails it the same way, so it is left in the settled
			// result to be reported per record.
			for (let idx = 0; idx < settled.length; idx += 1) {
				if (settled[idx].status === "fulfilled") continue;
				if (!records[idx]?.[parseErrorKey]) throw settled[idx].reason;
				if (ordered) break;
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
		const ordered = orderedBatchKind(records, streamsInOrder);
		if (ordered) return settleSequential(records, settle, ordered);
		return settleConcurrent(records, settle, concurrency);
	};
};

// SQS FIFO: "your function should stop processing messages after the first
// failure and return all failed and unprocessed messages in
// batchItemFailures". FIFO queue names must end in `.fifo`.
// docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
// Kinesis and DynamoDB Streams: "Lambda uses the record with the lowest
// sequence number as the checkpoint. Lambda then retries all records starting
// from that checkpoint", so a record after a failure is delivered again
// whatever happened to it.
// docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html
// docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html
const orderedBatchKind = (records, streamsInOrder) => {
	const eventSource = records[0]?.eventSource;
	if (eventSource === "aws:sqs") {
		return records[0].eventSourceARN?.endsWith(".fifo") === true
			? "FIFO"
			: undefined;
	}
	if (
		streamsInOrder &&
		(eventSource === "aws:kinesis" || eventSource === "aws:dynamodb")
	) {
		return "stream";
	}
	return undefined;
};

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
const settleSequential = async (records, run, kind) => {
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
	const unprocessed = new Error(
		`Unprocessed: an earlier ${kind} record failed`,
		{ cause: { package: pkg } },
	);
	for (idx += 1; idx < records.length; idx += 1) {
		settled.push({ status: "rejected", reason: unprocessed });
	}
	return settled;
};

export default eventBatchHandler;
