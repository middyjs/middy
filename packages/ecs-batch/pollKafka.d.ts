// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { MSKEvent, SelfManagedKafkaEvent } from "aws-lambda";
import type { Consumer, Kafka } from "kafkajs";
import type { Poller } from "./index.js";

export interface PollKafkaOptions {
	brokers: string[];
	groupId: string;
	topics: string[];
	clientId?: string;
	fromBeginning?: boolean;
	client?: Kafka;
	consumer?: Consumer;
	ssl?: boolean;
	eventSourceArn?: string;
	selfManaged?: boolean;
	/**
	 * How often (ms) to heartbeat the consumer group while the handler holds a
	 * batch. kafkajs throttles to its own heartbeatInterval. Defaults to 3000.
	 */
	heartbeatIntervalMs?: number;
}

export type KafkaEvent = MSKEvent | SelfManagedKafkaEvent;

// Lambda's Kafka partial batch response (not typed by @types/aws-lambda).
// The flat "topic-partition-offset" string form is also accepted.
// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
export interface KafkaBatchItemFailure {
	itemIdentifier: { partition: string; offset: number } | string;
}

export interface KafkaBatchResponse {
	batchItemFailures: KafkaBatchItemFailure[];
}

export interface KafkaPoller extends Poller<KafkaEvent, KafkaBatchResponse> {
	source: "aws:kafka" | "SelfManagedKafka";
	consumer: Consumer;
}

export declare function pollKafka(options: PollKafkaOptions): KafkaPoller;

export declare function pollKafkaValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollKafka;
