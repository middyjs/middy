// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { setTimeout as delay } from "node:timers/promises";
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
	},
	required: ["streamArn", "shardId"],
	additionalProperties: false,
};

export const pollDynamoDBStreamsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const toLambdaRecord = (record, streamArn, awsRegion) => ({
	eventID: record.eventID,
	eventName: record.eventName,
	eventVersion: record.eventVersion ?? "1.1",
	eventSource: "aws:dynamodb",
	awsRegion,
	dynamodb: record.dynamodb,
	eventSourceARN: streamArn,
});

export const pollDynamoDBStreams = (opts) => {
	pollDynamoDBStreamsValidateOptions(opts);
	const client = opts.client ?? new DynamoDBStreamsClient({});
	const shardIteratorType = opts.shardIteratorType ?? "LATEST";
	const limit = opts.limit ?? 1000;
	const pollingDelay = opts.pollingDelay ?? 1000;

	return {
		source: "aws:dynamodb",
		client,
		async *poll(signal) {
			let iterRes;
			try {
				iterRes = await client.send(
					new GetShardIteratorCommand({
						StreamArn: opts.streamArn,
						ShardId: opts.shardId,
						ShardIteratorType: shardIteratorType,
						SequenceNumber: opts.sequenceNumber,
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
							toLambdaRecord(r, opts.streamArn, opts.awsRegion),
						),
					};
				} else if (pollingDelay > 0) {
					await delay(pollingDelay);
				}
			}
		},
		async acknowledge() {},
	};
};

export default pollDynamoDBStreams;
