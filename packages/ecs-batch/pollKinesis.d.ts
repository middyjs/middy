// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { KinesisClient } from "@aws-sdk/client-kinesis";
import type {
	KinesisStreamBatchResponse,
	KinesisStreamEvent,
} from "aws-lambda";
import type { Poller } from "./index.js";

export type KinesisShardIteratorType =
	| "AT_SEQUENCE_NUMBER"
	| "AFTER_SEQUENCE_NUMBER"
	| "TRIM_HORIZON"
	| "LATEST"
	| "AT_TIMESTAMP";

export interface PollKinesisOptions {
	streamName: string;
	shardId: string;
	streamArn?: string;
	client?: KinesisClient;
	shardIteratorType?: KinesisShardIteratorType;
	startingSequenceNumber?: string;
	timestamp?: number;
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

export interface KinesisPoller
	extends Poller<KinesisStreamEvent, KinesisStreamBatchResponse> {
	source: "aws:kinesis";
	client: KinesisClient;
}

export declare function pollKinesis(options: PollKinesisOptions): KinesisPoller;

export declare function pollKinesisValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollKinesis;
