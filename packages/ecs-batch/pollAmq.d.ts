// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { ActiveMQEvent, MQBatchResponse } from "aws-lambda";
import type { Poller } from "./index.js";

export interface PollAmqOptions {
	connectOptions: Record<string, unknown>;
	destination: string;
	ackMode?: "client" | "client-individual";
	batchSize?: number;
	batchWindowMs?: number;
	client?: unknown;
	connect?: (connectOptions: Record<string, unknown>) => Promise<unknown>;
	eventSourceArn?: string;
}

export interface AmqPoller extends Poller<ActiveMQEvent, MQBatchResponse> {
	source: "aws:amq";
}

export declare function pollAmq(options: PollAmqOptions): AmqPoller;

export declare function pollAmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollAmq;
