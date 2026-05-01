// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { MQBatchResponse, RabbitMQEvent } from "aws-lambda";
import type { Poller } from "./index.js";

export interface PollRmqOptions {
	queue: string;
	url?: string;
	vhost?: string;
	prefetch?: number;
	batchSize?: number;
	batchWindowMs?: number;
	connection?: unknown;
	channel?: unknown;
	connect?: (url?: string) => Promise<unknown>;
	eventSourceArn?: string;
}

export interface RmqPoller extends Poller<RabbitMQEvent, MQBatchResponse> {
	source: "aws:rmq";
}

export declare function pollRmq(options: PollRmqOptions): RmqPoller;

export declare function pollRmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollRmq;
