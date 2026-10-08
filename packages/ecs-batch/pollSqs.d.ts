// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { Poller } from "./index.js";

export interface PollSqsOptions {
	queueUrl: string;
	client?: SQSClient;
	maxNumberOfMessages?: number;
	waitTimeSeconds?: number;
	visibilityTimeout?: number;
	eventSourceArn?: string;
	awsRegion?: string;
}

export interface SqsPoller extends Poller<SQSEvent, SQSBatchResponse> {
	source: "aws:sqs";
	client: SQSClient;
	/**
	 * Seconds, as configured. Unset, each receive hides messages for the
	 * runner's timeout plus 30 s; the runner rejects a value that does not
	 * outlast its timeout.
	 */
	visibilityTimeout?: number;
}

export declare function pollSqs(options: PollSqsOptions): SqsPoller;

export declare function pollSqsValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollSqs;
