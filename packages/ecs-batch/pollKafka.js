// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { validateOptions } from "@middy/util";
import { Kafka } from "kafkajs";

const pkg = "@middy/ecs-batch/pollKafka";

const optionSchema = {
	type: "object",
	properties: {
		clientId: { type: "string" },
		brokers: { type: "array", items: { type: "string" }, minItems: 1 },
		groupId: { type: "string" },
		topics: { type: "array", items: { type: "string" }, minItems: 1 },
		fromBeginning: { type: "boolean" },
		client: { type: "object", additionalProperties: true },
		consumer: { type: "object", additionalProperties: true },
		ssl: { type: "boolean" },
		eventSourceArn: { type: "string" },
		selfManaged: { type: "boolean" },
	},
	required: ["brokers", "groupId", "topics"],
	additionalProperties: false,
};

export const pollKafkaValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const toBase64 = (val) => {
	if (val == null) return null;
	if (Buffer.isBuffer(val)) return val.toString("base64");
	if (val instanceof Uint8Array) return Buffer.from(val).toString("base64");
	return Buffer.from(String(val)).toString("base64");
};

const buildKafkaRecord = (batch, message) => ({
	topic: batch.topic,
	partition: batch.partition,
	offset: Number(message.offset),
	timestamp: Number(message.timestamp),
	timestampType: "CREATE_TIME",
	key: toBase64(message.key),
	value: toBase64(message.value),
	headers: message.headers
		? Object.fromEntries(
				Object.entries(message.headers).map(([k, v]) => [k, toBase64(v)]),
			)
		: {},
});

export const pollKafka = (opts) => {
	pollKafkaValidateOptions(opts);
	const kafka =
		opts.client ??
		new Kafka({
			clientId: opts.clientId ?? "middy-ecs-batch",
			brokers: opts.brokers,
			ssl: opts.ssl,
		});
	const consumer = opts.consumer ?? kafka.consumer({ groupId: opts.groupId });
	const eventSource = opts.selfManaged ? "SelfManagedKafka" : "aws:kafka";

	// Bridges kafkajs's push-mode eachBatch to the runner's pull loop. Only one
	// batch is in flight at a time (partitionsConsumedConcurrently=1) so a
	// single ack-gate per poller suffices.
	let resolveNext;
	let resolveAck;
	let started = false;

	const waitForEvent = () =>
		new Promise((r) => {
			resolveNext = r;
		});
	const waitForAck = () =>
		new Promise((r) => {
			resolveAck = r;
		});

	const handover = (event) => {
		resolveNext?.({ event, done: false });
	};

	// signal.addEventListener uses {once: true}, so close runs exactly once
	// per poll() call. No idempotency flag needed.
	const close = () => {
		resolveNext?.({ done: true });
		resolveAck?.(new Set());
	};

	return {
		source: eventSource,
		consumer,
		async *poll(signal) {
			if (!started) {
				await consumer.connect();
				for (const topic of opts.topics) {
					await consumer.subscribe({
						topic,
						fromBeginning: opts.fromBeginning ?? false,
					});
				}
				started = true;
			}

			const onAbort = async () => {
				close();
				try {
					await consumer.disconnect();
				} catch {
					// disconnect during shutdown is best-effort
				}
			};
			signal.addEventListener("abort", onAbort, { once: true });

			consumer.run({
				autoCommit: false,
				partitionsConsumedConcurrently: 1,
				eachBatch: async ({
					batch,
					resolveOffset,
					commitOffsetsIfNecessary,
					heartbeat,
				}) => {
					if (signal.aborted) return;
					const topicKey = `${batch.topic}-${batch.partition}`;
					const event = {
						eventSource,
						eventSourceArn: opts.eventSourceArn,
						bootstrapServers: opts.brokers.join(","),
						records: {
							[topicKey]: batch.messages.map((m) => buildKafkaRecord(batch, m)),
						},
					};
					const ackGate = waitForAck();
					handover(event);
					const failed = await ackGate;
					// Kafka commits are sequential per partition: stop at the first
					// failed offset so its native redelivery path stays intact.
					for (const m of batch.messages) {
						const id = `${batch.topic}-${batch.partition}-${m.offset}`;
						if (failed?.has(id)) break;
						resolveOffset(m.offset);
					}
					await commitOffsetsIfNecessary();
					await heartbeat();
				},
			});

			while (!signal.aborted) {
				const next = await waitForEvent();
				if (next.done) return;
				yield next.event;
			}
		},
		async acknowledge(_event, response) {
			const failed = new Set(
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			resolveAck?.(failed);
		},
	};
};

export default pollKafka;
