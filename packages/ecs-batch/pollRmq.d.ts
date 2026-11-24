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
	/**
	 * Retries of a batch whose handler threw before its deliveries are
	 * rejected without a requeue (dead-lettered when the queue has a
	 * dead-letter exchange, dropped otherwise) and reported through the
	 * runner's onError. -1 (the default) retries forever, as Lambda does for
	 * Amazon MQ.
	 */
	maxRetryAttempts?: number;
	/**
	 * Backoff (ms) before a failed batch is delivered again, doubling per
	 * consecutive failure of that batch up to 30 s (or this value when
	 * larger). The deliveries stay unacknowledged with this consumer meanwhile.
	 * Defaults to 1000.
	 */
	retryDelayMs?: number;
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

// Lambda has no partial batch response for Amazon MQ, so the handler's
// response is not read: a batch whose handler returned is acknowledged in
// full, and one whose handler threw is retried in full.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
export interface RmqPoller extends Poller<RabbitMQEvent> {
	source: "aws:rmq";
}

export declare function pollRmq(options: PollRmqOptions): RmqPoller;

export declare function pollRmqValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollRmq;
