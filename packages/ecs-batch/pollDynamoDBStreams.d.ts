// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { DynamoDBStreamsClient } from "@aws-sdk/client-dynamodb-streams";
import type { DynamoDBBatchResponse, DynamoDBStreamEvent } from "aws-lambda";
import type { Poller } from "./index.js";

export type DynamoDBShardIteratorType =
	| "AT_SEQUENCE_NUMBER"
	| "AFTER_SEQUENCE_NUMBER"
	| "TRIM_HORIZON"
	| "LATEST";

export interface PollDynamoDBStreamsOptions {
	streamArn: string;
	shardId: string;
	client?: DynamoDBStreamsClient;
	shardIteratorType?: DynamoDBShardIteratorType;
	sequenceNumber?: string;
	limit?: number;
	pollingDelay?: number;
	awsRegion?: string;
}

export interface DynamoDBStreamsPoller
	extends Poller<DynamoDBStreamEvent, DynamoDBBatchResponse> {
	source: "aws:dynamodb";
	client: DynamoDBStreamsClient;
}

export declare function pollDynamoDBStreams(
	options: PollDynamoDBStreamsOptions,
): DynamoDBStreamsPoller;

export declare function pollDynamoDBStreamsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollDynamoDBStreams;
