// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// The module object rather than a named import so a test's mock timers can
// intercept setTimeout; a named import binds the real function at load time.
import timers from "node:timers/promises";
import {
	GetRecordsCommand,
	GetShardIteratorCommand,
	KinesisClient,
} from "@aws-sdk/client-kinesis";
import { validateOptions } from "@middy/util";
import { isTransientReadError, retryDelay, sleep } from "./pollHelpers.js";

const pkg = "@middy/ecs-batch/pollKinesis";

// "When delay is larger than 2147483647 or less than 1 or NaN, the delay will be set to 1."
// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
const timerMs = { type: "integer", minimum: 0, maximum: 2_147_483_647 };

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:ecs-batch:pollKinesis:options",
	$defs: { Object: false },
	type: "object",
	properties: {
		// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetShardIterator.html
		streamName: {
			type: "string",
			minLength: 1,
			maxLength: 128,
			pattern: /^[\w.-]+$/u,
		},
		streamArn: {
			type: "string",
			minLength: 1,
			maxLength: 2048,
			pattern: /^arn:aws[\w-]*:kinesis:[\w-]*:\d{12}:stream\/[\x21-\x7E]+$/u,
		},
		shardId: {
			type: "string",
			minLength: 1,
			maxLength: 128,
			pattern: /^[\w.-]+$/u,
		},
		client: { $ref: "#/$defs/Object" },
		shardIteratorType: {
			type: "string",
			enum: [
				"AT_SEQUENCE_NUMBER",
				"AFTER_SEQUENCE_NUMBER",
				"TRIM_HORIZON",
				"LATEST",
				"AT_TIMESTAMP",
			],
		},
		startingSequenceNumber: {
			type: "string",
			maxLength: 129,
			pattern: /^(?:0|[1-9]\d{0,128})$/u,
		},
		// Epoch seconds, at most the ECMAScript time value range of 8.64e15 ms:
		// https://tc39.es/ecma262/#sec-time-values-and-time-range
		timestamp: { type: "number", minimum: 0, maximum: 8_640_000_000_000 },
		// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetRecords.html
		limit: { type: "integer", minimum: 1, maximum: 10000 },
		pollingDelay: timerMs,
		// The SDK takes any region that is a valid host label:
		// node_modules/@smithy/core/dist-es/submodules/transport/isValidHostLabel.js
		awsRegion: { type: "string", maxLength: 63, pattern: /^[A-Za-z0-9-]+$/u },
		maxRetryAttempts: { type: "integer", minimum: -1, maximum: 10000 },
		retryDelayMs: timerMs,
	},
	required: ["streamName", "shardId"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const pollKinesisValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// A Buffer is a Uint8Array; viewing either over its own memory encodes the
// same bytes without a copy.
const toBase64 = (data) => {
	if (data === undefined || data === null) return "";
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) {
		return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
			"base64",
		);
	}
	return Buffer.from(String(data)).toString("base64");
};

const toLambdaRecord = (record, streamArn, awsRegion, shardId) => ({
	kinesis: {
		kinesisSchemaVersion: "1.0",
		partitionKey: record.PartitionKey,
		sequenceNumber: record.SequenceNumber,
		data: toBase64(record.Data),
		approximateArrivalTimestamp:
			record.ApproximateArrivalTimestamp instanceof Date
				? record.ApproximateArrivalTimestamp.getTime() / 1000
				: record.ApproximateArrivalTimestamp,
	},
	eventSource: "aws:kinesis",
	eventVersion: "1.0",
	eventID: `${shardId}:${record.SequenceNumber}`,
	eventName: "aws:kinesis:record",
	awsRegion,
	eventSourceARN: streamArn,
});

// arn:aws:kinesis:<region>:<account>:stream/<name>
const regionFromArn = (streamArn) => streamArn?.split(":")[3];

const noop = () => {};

// The first two are documented for GetRecords, the next two for every
// Kinesis action, and TimeoutError is what the SDK raises when its own
// request timeout fires.
// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetRecords.html
// https://docs.aws.amazon.com/kinesis/latest/APIReference/CommonErrors.html
// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/programming-with-javascript.html#programming-with-javascript-error-handling
const transientErrorNames = new Set([
	"ProvisionedThroughputExceededException",
	"KMSThrottlingException",
	"ThrottlingException",
	"RequestTimeoutException",
	"TimeoutError",
]);

// "This operation has a limit of five transactions per second per shard."
// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetRecords.html
const readsPerSecond = 5;

// A batchItemFailures entry whose itemIdentifier is null, empty or names no
// record in the batch invalidates the whole response: Lambda then retries
// every record. `ids` is the failed set to act on (every record when the
// response is invalid) and `error` the reason to raise through onError.
// https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html
const batchFailures = (response, knownIds) => {
	const ids = new Set();
	for (const entry of response?.batchItemFailures ?? []) {
		const itemIdentifier = entry?.itemIdentifier;
		if (!knownIds.has(itemIdentifier)) {
			return {
				ids: knownIds,
				error: new Error("Invalid batchItemFailures entry", {
					cause: { package: pkg, data: { itemIdentifier } },
				}),
			};
		}
		ids.add(itemIdentifier);
	}
	return { ids };
};

export const pollKinesis = (opts) => {
	pollKinesisValidateOptions(opts);
	const client = opts.client ?? new KinesisClient({});
	let awsRegion = opts.awsRegion ?? regionFromArn(opts.streamArn);
	const shardIteratorType = opts.shardIteratorType ?? "LATEST";
	const limit = opts.limit ?? 1000;
	const pollingDelay = opts.pollingDelay ?? 1000;
	// Lambda's MaximumRetryAttempts: -1 (the default) retries until the record
	// expires from the stream; otherwise the batch is discarded after that
	// many retries.
	// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
	const maxRetryAttempts = opts.maxRetryAttempts ?? -1;
	const retryDelayMs = opts.retryDelayMs ?? 1000;
	// Sequence numbers of the records each acknowledged batch failed, empty
	// once it fully succeeded.
	const failedRecords = new WeakMap();
	// Consecutive failures at the sequence number the retry starts from. The
	// iterator only moves forward, so a later failure is at a new sequence
	// number and never needs an explicit reset.
	let retry;
	let readFailures = 0;
	const recentReadStarts = new Array(readsPerSecond).fill(
		Number.NEGATIVE_INFINITY,
	);
	const waitForReadSlot = async (signal) => {
		const slotFreesAt = recentReadStarts.shift() + 1000;
		const wait = slotFreesAt - Date.now();
		if (wait > 0) await sleep(wait, signal);
		recentReadStarts.push(Date.now());
	};
	// Where the current iterator reads from, to ask for a new one there when it
	// expires.
	let position;
	// Past the batch, all of it processed or discarded.
	const after = (records) => ({
		ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
		StartingSequenceNumber: records.at(-1).SequenceNumber,
	});

	// "If a GetShardIterator request is made too often, you receive a
	// ProvisionedThroughputExceededException."
	// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetShardIterator.html
	const getShardIterator = async (signal, input, report) => {
		let failures = 0;
		while (!signal.aborted) {
			try {
				const res = await client.send(
					new GetShardIteratorCommand({
						StreamName: opts.streamName,
						ShardId: opts.shardId,
						...input,
					}),
					{ abortSignal: signal },
				);
				return res.ShardIterator;
			} catch (err) {
				if (signal.aborted) break;
				if (!isTransientReadError(err, transientErrorNames)) throw err;
				report(err);
				failures++;
				await sleep(retryDelay(retryDelayMs, failures), signal);
			}
		}
		return undefined;
	};

	// GetRecords returns a null NextShardIterator once the shard is closed (a
	// split, a merge, or a rotation) and read to its end. Nothing more will
	// arrive, so the poll fails instead of idling: the task stops and reports
	// it. Following the child shards is not implemented.
	// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetRecords.html
	const nextIterator = (res) => {
		if (res.NextShardIterator !== null && res.NextShardIterator !== undefined) {
			return res.NextShardIterator;
		}
		const err = new Error("Shard closed", {
			cause: {
				package: pkg,
				data: { shardId: opts.shardId, childShards: res.ChildShards },
			},
		});
		err.name = "SourceClosedError";
		throw err;
	};

	return {
		source: "aws:kinesis",
		client,
		async *poll(signal, report = noop) {
			// Without a stream ARN or an explicit region, take the client's, which
			// the SDK resolves asynchronously.
			awsRegion ??= await client.config?.region?.();
			position = {
				ShardIteratorType: shardIteratorType,
				StartingSequenceNumber: opts.startingSequenceNumber,
				Timestamp: opts.timestamp,
			};
			let shardIterator = await getShardIterator(signal, position, report);
			while (!signal.aborted && shardIterator) {
				await waitForReadSlot(signal);
				if (signal.aborted) return;
				let res;
				try {
					res = await client.send(
						new GetRecordsCommand({
							ShardIterator: shardIterator,
							Limit: limit,
						}),
						{ abortSignal: signal },
					);
				} catch (err) {
					if (signal.aborted) return;
					// An iterator expires 5 minutes after it was issued, which a long
					// handler or backoff can outlast: ask for a new one where it read.
					// https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetShardIterator.html
					if (err.name === "ExpiredIteratorException") {
						shardIterator = await getShardIterator(signal, position, report);
						continue;
					}
					if (!isTransientReadError(err, transientErrorNames)) throw err;
					report(err);
					readFailures++;
					await sleep(retryDelay(retryDelayMs, readFailures), signal);
					continue;
				}
				readFailures = 0;
				const records = res.Records ?? [];
				if (!records.length) {
					shardIterator = nextIterator(res);
					if (pollingDelay > 0) await timers.setTimeout(pollingDelay);
					continue;
				}
				const event = {
					Records: records.map((r) =>
						toLambdaRecord(r, opts.streamArn, awsRegion, opts.shardId),
					),
				};
				yield event;
				// The runner resumes here after acknowledging the batch, or after the
				// handler threw (nothing acknowledged: every record failed). As
				// Lambda checkpoints, only a fully successful batch advances the
				// iterator; otherwise the shard is re-read from the lowest failed
				// sequence number, after a backoff, until maxRetryAttempts is spent.
				// https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html
				if (signal.aborted) return;
				const failed =
					failedRecords.get(event) ?? records.map((r) => r.SequenceNumber);
				if (failed.length === 0) {
					position = after(records);
					shardIterator = nextIterator(res);
					continue;
				}
				const sequenceNumber = failed[0];
				const attempt =
					retry?.sequenceNumber === sequenceNumber ? retry.attempt + 1 : 1;
				if (maxRetryAttempts !== -1 && attempt > maxRetryAttempts) {
					report(
						new Error("Retry attempts exhausted", {
							cause: {
								package: pkg,
								data: { shardId: opts.shardId, sequenceNumbers: failed },
							},
						}),
						event,
					);
					position = after(records);
					shardIterator = nextIterator(res);
					continue;
				}
				retry = { sequenceNumber, attempt };
				await sleep(retryDelay(retryDelayMs, attempt), signal);
				position = {
					ShardIteratorType: "AT_SEQUENCE_NUMBER",
					StartingSequenceNumber: sequenceNumber,
				};
				shardIterator = await getShardIterator(signal, position, report);
			}
		},
		// Records a batch's failed sequence numbers for the poll loop. Records arrive in
		// sequence order, so the first failed record has the lowest sequence
		// number. The checkpoint lives in memory only: a restarted worker starts
		// from shardIteratorType again.
		async acknowledge(event, response) {
			const records = event.Records ?? [];
			const failed = batchFailures(
				response,
				new Set(records.map((r) => r.kinesis.sequenceNumber)),
			);
			failedRecords.set(
				event,
				records
					.filter((r) => failed.ids.has(r.kinesis.sequenceNumber))
					.map((r) => r.kinesis.sequenceNumber),
			);
			if (failed.error) throw failed.error;
		},
	};
};

export default pollKinesis;
