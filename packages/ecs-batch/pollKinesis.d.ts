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
