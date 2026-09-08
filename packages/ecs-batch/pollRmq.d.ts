// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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

// @types/aws-lambda has no RabbitMQ types; these mirror the documented event.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
export interface RabbitMQHeaderBytes {
	bytes: number[];
}

export interface RabbitMQBasicProperties {
	contentType: string | null;
	contentEncoding: string | null;
	// String and byte-array header values arrive as RabbitMQHeaderBytes;
	// numbers and booleans pass through unchanged.
	headers: Record<string, RabbitMQHeaderBytes | number | boolean | unknown>;
	deliveryMode: number;
	priority: number | null;
	correlationId: string | null;
	replyTo: string | null;
	expiration: string | null;
	messageId: string | null;
	// Rendered as an en-US date-time string in UTC, e.g.
	// "Jan 1, 1970, 12:33:41 AM".
	timestamp: string | null;
	type: string | null;
	userId: string | null;
	appId: string | null;
	clusterId: string | null;
	bodySize: number;
}

export interface RabbitMQMessage {
	basicProperties: RabbitMQBasicProperties;
	redelivered: boolean;
	data: string;
}

export interface RabbitMQEvent {
	eventSource: "aws:rmq";
	eventSourceArn?: string;
	rmqMessagesByQueue: Record<string, RabbitMQMessage[]>;
}

// Lambda has no partial batch response for Amazon MQ. The runner accepts one
// keyed by the AMQP delivery tag (as a string) so a handler can ack and nack
// per message.
export interface MQBatchItemFailure {
	itemIdentifier: string;
}

export interface MQBatchResponse {
	batchItemFailures: MQBatchItemFailure[];
}

export interface RmqPoller extends Poller<RabbitMQEvent, MQBatchResponse> {
	source: "aws:rmq";
}

export declare function pollRmq(options: PollRmqOptions): RmqPoller;

export declare function pollRmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollRmq;
