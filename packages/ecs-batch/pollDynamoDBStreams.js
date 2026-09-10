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

export const pollDynamoDBStreams = (opts) => {
	pollDynamoDBStreamsValidateOptions(opts);
	const client = opts.client ?? new DynamoDBStreamsClient({});
	const awsRegion = opts.awsRegion ?? regionFromArn(opts.streamArn);
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
							toLambdaRecord(r, opts.streamArn, awsRegion),
						),
					};
				} else if (pollingDelay > 0) {
					await timers.setTimeout(pollingDelay);
				}
			}
		},
		async acknowledge() {},
	};
};

export default pollDynamoDBStreams;
