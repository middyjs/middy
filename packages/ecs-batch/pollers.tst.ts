import { expect, test } from "tstyche";
import {
	type ActiveMQEvent,
	type AmqPoller,
	type MQBatchResponse,
	pollAmq,
} from "./pollAmq.js";
import {
	type DynamoDBStreamsPoller,
	pollDynamoDBStreams,
} from "./pollDynamoDBStreams.js";
import {
	type KafkaBatchResponse,
	type KafkaEvent,
	type KafkaPoller,
	pollKafka,
} from "./pollKafka.js";
import { type KinesisPoller, pollKinesis } from "./pollKinesis.js";
import { pollRmq, type RabbitMQEvent, type RmqPoller } from "./pollRmq.js";
import { pollSqs, type SqsPoller } from "./pollSqs.js";

test("poller factories return typed pollers", () => {
	expect(
		pollSqs({ queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q" }),
	).type.toBe<SqsPoller>();
	expect(
		pollKinesis({ streamName: "s", shardId: "0" }),
	).type.toBe<KinesisPoller>();
	expect(
		pollDynamoDBStreams({ streamArn: "arn", shardId: "0" }),
	).type.toBe<DynamoDBStreamsPoller>();
	expect(
		pollKafka({ brokers: ["b"], groupId: "g", topics: ["t"] }),
	).type.toBe<KafkaPoller>();
	expect(
		pollAmq({ connectOptions: {}, destination: "/queue/q" }),
	).type.toBe<AmqPoller>();
	expect(pollRmq({ queue: "q" })).type.toBe<RmqPoller>();
});

test("Kafka batch failures accept Lambda's object identifier and the legacy string", () => {
	expect({
		batchItemFailures: [{ itemIdentifier: { partition: "t-0", offset: 15 } }],
	}).type.toBeAssignableTo<KafkaBatchResponse>();
	expect({
		batchItemFailures: [{ itemIdentifier: "t-0-15" }],
	}).type.toBeAssignableTo<KafkaBatchResponse>();
	expect({
		batchItemFailures: [{ itemIdentifier: 15 }],
	}).type.not.toBeAssignableTo<KafkaBatchResponse>();
});

test("Kafka records carry headers as byte arrays", () => {
	expect<KafkaEvent["records"][string][number]["headers"][number]>().type.toBe<
		Record<string, number[]>
	>();
});

test("ActiveMQ and RabbitMQ events use the documented record shapes", () => {
	expect<ActiveMQEvent["messages"][number]["destination"]>().type.toBe<{
		physicalName: string;
	}>();
	expect<ActiveMQEvent["messages"][number]["properties"]>().type.toBe<
		Record<string, string>
	>();
	// The AWS-maintained event types spell it correlationID.
	expect<ActiveMQEvent["messages"][number]["correlationID"]>().type.toBe<
		string | null
	>();
	expect<ActiveMQEvent["messages"][number]>().type.not.toHaveProperty(
		"correlationId",
	);
	expect<
		RabbitMQEvent["rmqMessagesByQueue"][string][number]["basicProperties"]["bodySize"]
	>().type.toBe<number>();
	expect<
		RabbitMQEvent["rmqMessagesByQueue"][string][number]["basicProperties"]["timestamp"]
	>().type.toBe<string | null>();
	expect({
		batchItemFailures: [{ itemIdentifier: "ID:1" }],
	}).type.toBeAssignableTo<MQBatchResponse>();
});
