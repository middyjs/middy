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

const pkg = "@middy/ecs-batch/pollKinesis";

const optionSchema = {
	type: "object",
	properties: {
		streamName: { type: "string" },
		streamArn: { type: "string" },
		shardId: { type: "string" },
		client: { type: "object", additionalProperties: true },
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
		startingSequenceNumber: { type: "string" },
		timestamp: { type: "number" },
		limit: { type: "integer", minimum: 1, maximum: 10000 },
		pollingDelay: { type: "integer", minimum: 0 },
		awsRegion: { type: "string" },
		maxRetryAttempts: { type: "integer", minimum: -1, maximum: 10000 },
		retryDelayMs: { type: "integer", minimum: 0 },
	},
	required: ["streamName", "shardId"],
	additionalProperties: false,
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

// Backoff before a failed batch is re-read: retryDelayMs, doubling per
// consecutive failure at the same sequence number, capped at 30 s (or
// retryDelayMs when that is larger).
const retryDelay = (retryDelayMs, attempt) =>
	Math.min(retryDelayMs * 2 ** (attempt - 1), Math.max(retryDelayMs, 30_000));

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
	// Where the current iterator reads from, to ask for a new one there when it
	// expires.
	let position;
	// Past the batch, all of it processed or discarded.
	const after = (records) => ({
		ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
		StartingSequenceNumber: records.at(-1).SequenceNumber,
	});

	// Resolves undefined when the signal aborted the request.
	const getShardIterator = async (signal, input) => {
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
			if (signal.aborted) return undefined;
			throw err;
		}
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
			let shardIterator = await getShardIterator(signal, position);
			while (!signal.aborted && shardIterator) {
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
					if (err.name !== "ExpiredIteratorException") throw err;
					shardIterator = await getShardIterator(signal, position);
					continue;
				}
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
				try {
					await timers.setTimeout(
						retryDelay(retryDelayMs, attempt),
						undefined,
						{
							signal,
						},
					);
				} catch {
					// aborted: shutting down, the batch is re-read after restart
					return;
				}
				position = {
					ShardIteratorType: "AT_SEQUENCE_NUMBER",
					StartingSequenceNumber: sequenceNumber,
				};
				shardIterator = await getShardIterator(signal, position);
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
