// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	MSKBatchResponse,
	MSKEvent,
	SelfManagedKafkaEvent,
} from "aws-lambda";
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
}

export type KafkaEvent = MSKEvent | SelfManagedKafkaEvent;

export interface KafkaPoller extends Poller<KafkaEvent, MSKBatchResponse> {
	source: "aws:kafka" | "SelfManagedKafka";
	consumer: Consumer;
}

export declare function pollKafka(options: PollKafkaOptions): KafkaPoller;

export declare function pollKafkaValidateOptions(
	options?: Record<string, unknown>,
): void;

export default pollKafka;
