import { expect, test } from "tstyche";
import { type ActiveMQEvent, type AmqPoller, pollAmq } from "./pollAmq.js";
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

test("SqsPoller exposes its visibilityTimeout", () => {
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
	});
	expect(poller.visibilityTimeout).type.toBe<number | undefined>();
	expect(poller.poll).type.toBeCallableWith(
		new AbortController().signal,
		() => {},
		{ timeout: 1000 },
	);
});

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

test("stream and Kafka pollers take maxRetryAttempts and retryDelayMs", () => {
	expect(
		pollKinesis({
			streamName: "s",
			shardId: "0",
			maxRetryAttempts: 3,
			retryDelayMs: 500,
		}),
	).type.toBe<KinesisPoller>();
	expect(
		pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			maxRetryAttempts: -1,
			retryDelayMs: 0,
		}),
	).type.toBe<DynamoDBStreamsPoller>();
	expect(
		pollKafka({
			brokers: ["b"],
			groupId: "g",
			topics: ["t"],
			maxRetryAttempts: 10,
			retryDelayMs: 1000,
		}),
	).type.toBe<KafkaPoller>();
	expect(pollKafka).type.not.toBeCallableWith({
		brokers: ["b"],
		groupId: "g",
		topics: ["t"],
		maxRetryAttempts: "3",
	});
});

test("pollDynamoDBStreams takes AT_TIMESTAMP with an epoch-seconds timestamp", () => {
	expect(
		pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			shardIteratorType: "AT_TIMESTAMP",
			timestamp: 1_791_316_726.48,
		}),
	).type.toBe<DynamoDBStreamsPoller>();
	expect(pollDynamoDBStreams).type.not.toBeCallableWith({
		streamArn: "arn",
		shardId: "0",
		shardIteratorType: "AT_TIMESTAMP",
		timestamp: new Date(),
	});
});

test("pollKafka takes ssl as a boolean or TLS connection options", () => {
	const base = { brokers: ["b"], groupId: "g", topics: ["t"] };
	expect(pollKafka({ ...base, ssl: true })).type.toBe<KafkaPoller>();
	expect(
		pollKafka({ ...base, ssl: { rejectUnauthorized: true, ca: ["pem"] } }),
	).type.toBe<KafkaPoller>();
	expect(pollKafka).type.not.toBeCallableWith({ ...base, ssl: "true" });
});

test("broker pollers take maxRetryAttempts and retryDelayMs", () => {
	expect(
		pollAmq({
			connectOptions: {},
			destination: "/queue/q",
			maxRetryAttempts: 3,
			retryDelayMs: 500,
		}),
	).type.toBe<AmqPoller>();
	expect(
		pollRmq({ queue: "q", maxRetryAttempts: -1, retryDelayMs: 0 }),
	).type.toBe<RmqPoller>();
	expect(pollAmq).type.not.toBeCallableWith({
		connectOptions: {},
		destination: "/queue/q",
		retryDelayMs: "500",
	});
	expect(pollRmq).type.not.toBeCallableWith({
		queue: "q",
		maxRetryAttempts: "3",
	});
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
});

test("broker pollers do not type a partial batch response", () => {
	expect<Parameters<AmqPoller["acknowledge"]>[1]>().type.toBe<unknown>();
	expect<Parameters<RmqPoller["acknowledge"]>[1]>().type.toBe<unknown>();
});
