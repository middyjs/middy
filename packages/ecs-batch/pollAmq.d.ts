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

// Lambda has no partial batch response for Amazon MQ. The runner accepts one
// keyed by messageID so a handler can ack and nack per message.
export interface MQBatchItemFailure {
	itemIdentifier: string;
}

export interface MQBatchResponse {
	batchItemFailures: MQBatchItemFailure[];
}

export interface AmqPoller extends Poller<ActiveMQEvent, MQBatchResponse> {
	source: "aws:amq";
}

export declare function pollAmq(options: PollAmqOptions): AmqPoller;

export declare function pollAmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollAmq;
