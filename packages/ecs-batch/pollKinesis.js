// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { setTimeout as delay } from "node:timers/promises";
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
	},
	required: ["streamName", "shardId"],
	additionalProperties: false,
};

export const pollKinesisValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const toBase64 = (data) => {
	if (data == null) return "";
	if (typeof data === "string") return data;
	if (Buffer.isBuffer(data)) return data.toString("base64");
	if (data instanceof Uint8Array) return Buffer.from(data).toString("base64");
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

export const pollKinesis = (opts) => {
	pollKinesisValidateOptions(opts);
	const client = opts.client ?? new KinesisClient({});
	const shardIteratorType = opts.shardIteratorType ?? "LATEST";
	const limit = opts.limit ?? 1000;
	const pollingDelay = opts.pollingDelay ?? 1000;

	return {
		source: "aws:kinesis",
		client,
		async *poll(signal) {
			let iterRes;
			try {
				iterRes = await client.send(
					new GetShardIteratorCommand({
						StreamName: opts.streamName,
						ShardId: opts.shardId,
						ShardIteratorType: shardIteratorType,
						StartingSequenceNumber: opts.startingSequenceNumber,
						Timestamp: opts.timestamp,
					}),
					{ abortSignal: signal },
				);
			} catch (err) {
				if (signal.aborted) return;
				throw err;
			}
			let shardIterator = iterRes.ShardIterator;
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
					throw err;
				}
				shardIterator = res.NextShardIterator;
				const records = res.Records ?? [];
				if (records.length) {
					yield {
						Records: records.map((r) =>
							toLambdaRecord(r, opts.streamArn, opts.awsRegion, opts.shardId),
						),
					};
				} else if (pollingDelay > 0) {
					await delay(pollingDelay);
				}
			}
		},
		// Stream sources advance their iterator internally on the next poll.
		// Checkpointing (e.g. saving SequenceNumber to DynamoDB) is the user's
		// responsibility and lives in their middy chain.
		async acknowledge() {},
	};
};

export default pollKinesis;
