// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { setTimeout as delay } from "node:timers/promises";
import { validateOptions } from "@middy/util";
import amqplib from "amqplib";

const pkg = "@middy/ecs-batch/pollRmq";

const optionSchema = {
	type: "object",
	properties: {
		url: { type: "string" },
		queue: { type: "string" },
		vhost: { type: "string" },
		prefetch: { type: "integer", minimum: 1 },
		batchSize: { type: "integer", minimum: 1 },
		batchWindowMs: { type: "integer", minimum: 0 },
		connection: { type: "object", additionalProperties: true },
		channel: { type: "object", additionalProperties: true },
		connect: { instanceof: "Function" },
		eventSourceArn: { type: "string" },
	},
	required: ["queue"],
	additionalProperties: false,
};

export const pollRmqValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const buildRmqRecord = (msg) => ({
	basicProperties: {
		contentType: msg.properties.contentType ?? null,
		contentEncoding: msg.properties.contentEncoding ?? null,
		headers: msg.properties.headers ?? {},
		deliveryMode: msg.properties.deliveryMode ?? 1,
		priority: msg.properties.priority ?? null,
		correlationId: msg.properties.correlationId ?? null,
		replyTo: msg.properties.replyTo ?? null,
		expiration: msg.properties.expiration ?? null,
		messageId: msg.properties.messageId ?? null,
		timestamp: msg.properties.timestamp ?? null,
		type: msg.properties.type ?? null,
		userId: msg.properties.userId ?? null,
		appId: msg.properties.appId ?? null,
		clusterId: msg.properties.clusterId ?? null,
	},
	redelivered: msg.fields.redelivered ?? false,
	data: msg.content.toString("base64"),
});

const identifierFor = (msg) => String(msg.fields.deliveryTag);

export const pollRmq = (opts) => {
	pollRmqValidateOptions(opts);
	const queueKey = `${opts.queue}::${opts.vhost ?? "/"}`;
	const batchSize = opts.batchSize ?? 10;
	const batchWindowMs = opts.batchWindowMs ?? 1000;
	const prefetch = opts.prefetch ?? batchSize * 2;

	const connect = opts.connect ?? amqplib.connect;
	let connection = opts.connection;
	let channel = opts.channel;
	const pending = [];
	const inflight = new WeakMap();
	let resolveNext;

	const wakeReader = () => {
		resolveNext?.();
		resolveNext = undefined;
	};

	return {
		source: "aws:rmq",
		async *poll(signal) {
			if (!connection) connection = await connect(opts.url);
			if (!channel) channel = await connection.createChannel();
			await channel.prefetch(prefetch);

			const onAbort = async () => {
				wakeReader();
				try {
					await channel?.close();
					await connection?.close();
				} catch {
					// best-effort
				}
			};
			signal.addEventListener("abort", onAbort, { once: true });

			await channel.consume(
				opts.queue,
				(msg) => {
					if (!msg) return;
					pending.push(msg);
					wakeReader();
				},
				{ noAck: false },
			);

			while (!signal.aborted) {
				if (pending.length === 0) {
					await new Promise((r) => {
						resolveNext = r;
					});
					continue;
				}
				const deadline = Date.now() + batchWindowMs;
				while (
					pending.length < batchSize &&
					Date.now() < deadline &&
					!signal.aborted
				) {
					await delay(Math.min(50, deadline - Date.now()));
				}
				if (signal.aborted) return;
				const taken = pending.splice(0, batchSize);
				const event = {
					eventSource: "aws:rmq",
					eventSourceArn: opts.eventSourceArn,
					rmqMessagesByQueue: {
						[queueKey]: taken.map(buildRmqRecord),
					},
				};
				inflight.set(event, taken);
				yield event;
			}
		},
		async acknowledge(event, response) {
			const failed = new Set(
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			const taken = inflight.get(event) ?? [];
			inflight.delete(event);
			for (const msg of taken) {
				if (failed.has(identifierFor(msg))) {
					channel?.nack(msg, false, true);
				} else {
					channel?.ack(msg);
				}
			}
		},
	};
};

export default pollRmq;
