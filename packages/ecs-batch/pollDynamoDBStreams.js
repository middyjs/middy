// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// The module object rather than a named import so a test's mock timers can
// intercept setTimeout; a named import binds the real function at load time.
import timers from "node:timers/promises";
import {
	DynamoDBStreamsClient,
	GetRecordsCommand,
	GetShardIteratorCommand,
} from "@aws-sdk/client-dynamodb-streams";
import { validateOptions } from "@middy/util";

const pkg = "@middy/ecs-batch/pollDynamoDBStreams";

const optionSchema = {
	type: "object",
	properties: {
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
			],
		},
		sequenceNumber: { type: "string" },
		limit: { type: "integer", minimum: 1, maximum: 1000 },
		pollingDelay: { type: "integer", minimum: 0 },
		awsRegion: { type: "string" },
		maxRetryAttempts: { type: "integer", minimum: -1, maximum: 10000 },
		retryDelayMs: { type: "integer", minimum: 0 },
	},
	required: ["streamArn", "shardId"],
	additionalProperties: false,
};

export const pollDynamoDBStreamsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// The SDK decodes ApproximateCreationDateTime as a Date; Lambda delivers it
// as epoch seconds rounded down.
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_StreamRecord.html
const toLambdaStreamRecord = (dynamodb) => {
	const out = { ...dynamodb };
	if (out.ApproximateCreationDateTime instanceof Date) {
		out.ApproximateCreationDateTime = Math.floor(
			out.ApproximateCreationDateTime.getTime() / 1000,
		);
	}
	return out;
};

const toLambdaRecord = (record, streamArn, awsRegion) => {
	const out = {
		eventID: record.eventID,
		eventName: record.eventName,
		eventVersion: record.eventVersion ?? "1.1",
		eventSource: "aws:dynamodb",
		awsRegion,
		dynamodb: toLambdaStreamRecord(record.dynamodb),
		eventSourceARN: streamArn,
	};
	// Set on Time to Live deletes. The Streams API Identity shape is
	// { PrincipalId, Type }; Lambda delivers { type, principalId }.
	// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-streams.html
	if (record.userIdentity !== undefined) {
		out.userIdentity = {
			type: record.userIdentity.Type,
			principalId: record.userIdentity.PrincipalId,
		};
	}
	return out;
};

// arn:aws:dynamodb:<region>:<account>:table/<name>/stream/<label>
const regionFromArn = (streamArn) => streamArn.split(":")[3];

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
// https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html
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

export const pollDynamoDBStreams = (opts) => {
	pollDynamoDBStreamsValidateOptions(opts);
	const client = opts.client ?? new DynamoDBStreamsClient({});
	const awsRegion = opts.awsRegion ?? regionFromArn(opts.streamArn);
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
	// expires, with the failed records a retry from there re-reads.
	let position;

	// Resolves undefined when the signal aborted the request.
	const getShardIterator = async (signal, input) => {
		try {
			const res = await client.send(
				new GetShardIteratorCommand({
					StreamArn: opts.streamArn,
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

	// Records older than the 24 hour retention are trimmed, and asking for an
	// iterator at one throws TrimmedDataAccessException. A retry can outlive
	// its records that way: report them as lost and carry on from the oldest
	// record still in the shard rather than failing the worker.
	// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_GetShardIterator.html
	const seek = async (signal, event, report) => {
		try {
			return await getShardIterator(signal, position.input);
		} catch (err) {
			if (err.name !== "TrimmedDataAccessException") throw err;
			report(
				new Error("Records trimmed from the stream", {
					cause: {
						package: pkg,
						data: { shardId: opts.shardId, sequenceNumbers: position.failed },
					},
				}),
				event,
			);
			position = { input: { ShardIteratorType: "TRIM_HORIZON" }, failed: [] };
			return getShardIterator(signal, position.input);
		}
	};
	// Past the batch, all of it processed or discarded.
	const after = (records) => ({
		input: {
			ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
			SequenceNumber: records.at(-1).dynamodb.SequenceNumber,
		},
		failed: [],
	});

	// GetRecords returns a null NextShardIterator once the shard is closed (a
	// split, a merge, or a rotation) and read to its end. Nothing more will
	// arrive, so the poll fails instead of idling: the task stops and reports
	// it. Following the child shards is not implemented.
	// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_GetRecords.html
	const nextIterator = (res) => {
		if (res.NextShardIterator !== null && res.NextShardIterator !== undefined) {
			return res.NextShardIterator;
		}
		const err = new Error("Shard closed", {
			cause: { package: pkg, data: { shardId: opts.shardId } },
		});
		err.name = "SourceClosedError";
		throw err;
	};

	return {
		source: "aws:dynamodb",
		client,
		async *poll(signal, report = noop) {
			position = {
				input: {
					ShardIteratorType: shardIteratorType,
					SequenceNumber: opts.sequenceNumber,
				},
				failed: [],
			};
			let shardIterator = await getShardIterator(signal, position.input);
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
					// An iterator expires 15 minutes after it was issued, which a long
					// handler or backoff can outlast: ask for a new one where it read.
					// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_GetRecords.html
					if (err.name !== "ExpiredIteratorException") throw err;
					shardIterator = await seek(signal, undefined, report);
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
						toLambdaRecord(r, opts.streamArn, awsRegion),
					),
				};
				yield event;
				// The runner resumes here after acknowledging the batch, or after the
				// handler threw (nothing acknowledged: every record failed). As
				// Lambda checkpoints, only a fully successful batch advances the
				// iterator; otherwise the shard is re-read from the lowest failed
				// sequence number, after a backoff, until maxRetryAttempts is spent.
				// https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html
				if (signal.aborted) return;
				const failed =
					failedRecords.get(event) ??
					records.map((r) => r.dynamodb.SequenceNumber);
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
					input: {
						ShardIteratorType: "AT_SEQUENCE_NUMBER",
						SequenceNumber: sequenceNumber,
					},
					failed,
				};
				shardIterator = await seek(signal, event, report);
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
				new Set(records.map((r) => r.dynamodb.SequenceNumber)),
			);
			failedRecords.set(
				event,
				records
					.filter((r) => failed.ids.has(r.dynamodb.SequenceNumber))
					.map((r) => r.dynamodb.SequenceNumber),
			);
			if (failed.error) throw failed.error;
		},
	};
};

export default pollDynamoDBStreams;
