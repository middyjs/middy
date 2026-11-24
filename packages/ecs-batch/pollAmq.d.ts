// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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
	/**
	 * Retries of a batch whose handler threw before its messages are NACKed
	 * (which ActiveMQ dead-letters) and reported through the runner's onError.
	 * -1 (the default) retries forever, as Lambda does for Amazon MQ.
	 */
	maxRetryAttempts?: number;
	/**
	 * Backoff (ms) before a failed batch is delivered again, doubling per
	 * consecutive failure of that batch up to 30 s (or this value when
	 * larger). The messages stay unacknowledged with this consumer meanwhile.
	 * Defaults to 1000.
	 */
	retryDelayMs?: number;
}

// @types/aws-lambda has no ActiveMQ types; these mirror the documented event.
// brokerInTime/brokerOutTime are optional because STOMP frames never carry
// them, so the poller does not emit them.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
export interface ActiveMQMessage {
	messageID: string;
	messageType: string;
	deliveryMode: number;
	replyTo: string | null;
	type: string | null;
	expiration: string | null;
	priority: number;
	correlationID: string | null;
	redelivered: boolean;
	destination: { physicalName: string };
	data: string;
	timestamp: number;
	brokerInTime?: number;
	brokerOutTime?: number;
	properties: Record<string, string>;
}

export interface ActiveMQEvent {
	eventSource: "aws:amq";
	eventSourceArn?: string;
	messages: ActiveMQMessage[];
}

// Lambda has no partial batch response for Amazon MQ, so the handler's
// response is not read: a batch whose handler returned is acknowledged in
// full, and one whose handler threw is retried in full.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
export interface AmqPoller extends Poller<ActiveMQEvent> {
	source: "aws:amq";
}

export declare function pollAmq(options: PollAmqOptions): AmqPoller;

export declare function pollAmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollAmq;
