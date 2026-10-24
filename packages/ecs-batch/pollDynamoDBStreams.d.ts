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
	/**
	 * Retries of a failed batch before its failed records are discarded and
	 * reported through the runner's onError, as Lambda's MaximumRetryAttempts.
	 * -1 (the default) retries forever.
	 */
	maxRetryAttempts?: number;
	/**
	 * Backoff (ms) before a failed batch is retried, doubling per consecutive
	 * failure of the same record up to 30 s (or this value when larger).
	 * Defaults to 1000.
	 */
	retryDelayMs?: number;
	/** Defaults to the region in `streamArn`. */
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
