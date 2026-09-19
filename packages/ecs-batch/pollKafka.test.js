// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, mock, test } from "node:test";

// kafkajs is replaced before ./pollKafka.js loads so the arguments handed to
// the Kafka constructor and to kafka.consumer() are observable. The double
// never opens a socket: nothing in this file connects, runs or subscribes.
const constructed = [];
const consumers = [];
const consumer = {
	async connect() {},
	async disconnect() {},
	async subscribe() {},
	run() {},
};
class Kafka {
	constructor(config) {
		constructed.push(config);
	}
	consumer(config) {
		consumers.push(config);
		return consumer;
	}
}
mock.module("kafkajs", { namedExports: { Kafka } });
const { pollKafka } = await import("./pollKafka.js");

const base = { brokers: ["b1:9092", "b2:9092"], groupId: "g", topics: ["t"] };

describe("@middy/ecs-batch/pollKafka", () => {
	test.afterEach(() => {
		constructed.length = 0;
		consumers.length = 0;
	});

	test("pollKafka builds the kafkajs client from brokers and ssl with a default clientId", () => {
		const poller = pollKafka(base);
		deepStrictEqual(constructed, [
			{ clientId: "middy-ecs-batch", brokers: base.brokers, ssl: undefined },
		]);
		deepStrictEqual(consumers, [{ groupId: "g" }]);
		strictEqual(poller.consumer, consumer);
	});

	test("pollKafka forwards clientId and ssl to the kafkajs client", () => {
		pollKafka({ ...base, clientId: "orders", ssl: true });
		deepStrictEqual(constructed, [
			{ clientId: "orders", brokers: base.brokers, ssl: true },
		]);
	});

	test("pollKafka takes the consumer from an injected client", () => {
		const groupIds = [];
		const client = {
			consumer: (config) => {
				groupIds.push(config);
				return consumer;
			},
		};
		const poller = pollKafka({ ...base, client });
		deepStrictEqual(constructed, []);
		deepStrictEqual(groupIds, [{ groupId: "g" }]);
		strictEqual(poller.consumer, consumer);
	});

	test("pollKafka uses an injected consumer as is", () => {
		const injected = { ...consumer };
		const poller = pollKafka({ ...base, consumer: injected });
		deepStrictEqual(consumers, []);
		strictEqual(poller.consumer, injected);
	});
});
