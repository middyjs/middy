// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";
import amqplib from "amqplib";
import { mqBatcher } from "./pollHelpers.js";

const pkg = "@middy/ecs-batch/pollRmq";

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:ecs-batch:pollRmq:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		url: {
			type: "string",
			maxLength: 1024,
			pattern: /^amqps?:\/\/[\x21-\x7E]+$/u,
		},
		// "Queue names may be up to 255 bytes of UTF-8 characters."
		// https://www.rabbitmq.com/docs/queues#names
		queue: {
			type: "string",
			maxLength: 255,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
		},
		vhost: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
		},
		// amqplib writes prefetchCount with writeUInt16BE:
		// node_modules/amqplib/lib/defs.js
		prefetch: { type: "integer", minimum: 1, maximum: 65535 },
		// BatchSize and MaximumBatchingWindowInSeconds "from 0 seconds to 300 seconds":
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		batchSize: { type: "integer", minimum: 1, maximum: 10000 },
		batchWindowMs: { type: "integer", minimum: 0, maximum: 300_000 },
		connection: { $ref: "#/$defs/Object" },
		channel: { $ref: "#/$defs/Object" },
		connect: { $ref: "#/$defs/Function" },
		// EventSourceArn "arn:(aws[a-zA-Z0-9-]*):([a-zA-Z0-9\-])+:([a-z]{2}(-gov)?-[a-z]+-\d{1})?:(\d{12})?:(.*)":
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		eventSourceArn: {
			type: "string",
			maxLength: 1024,
			pattern: /^arn:aws[\w-]*:[\w-]+:[\w-]*:(?:\d{12})?:[\x21-\x7E]+$/u,
		},
		maxRetryAttempts: { type: "integer", minimum: -1, maximum: 10000 },
		// "When delay is larger than 2147483647 or less than 1 or NaN, the delay will be set to 1."
		// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
		retryDelayMs: { type: "integer", minimum: 0, maximum: 2_147_483_647 },
	},
	required: ["queue"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const pollRmqValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// Lambda serialises AMQP long-string and byte-array header values as
// { bytes: [...] }. amqplib decodes the former to a JS string and the latter
// to a Buffer; other field-table types (numbers, booleans) pass through.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
const toLambdaHeaderValue = (value) => {
	if (typeof value === "string") {
		return { bytes: Array.from(Buffer.from(value)) };
	}
	if (Buffer.isBuffer(value)) return { bytes: Array.from(value) };
	return value;
};

const toLambdaHeaders = (headers) => {
	const out = {};
	for (const [key, value] of Object.entries(headers ?? {})) {
		out[key] = toLambdaHeaderValue(value);
	}
	return out;
};

// Lambda renders the AMQP timestamp (epoch seconds) as an en-US medium
// date-time string in UTC, e.g. "Jan 1, 1970, 12:33:41 AM". Assembled from
// toUTCString ("Thu, 01 Jan 1970 00:33:41 GMT", fixed by the language spec)
// rather than Intl, whose ICU builds disagree on the space before AM/PM.
const toLambdaTimestamp = (seconds) => {
	const date = new Date(seconds * 1000);
	const utc = date.toUTCString();
	const hours = date.getUTCHours();
	return `${utc.slice(8, 11)} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hours % 12 || 12}:${utc.slice(20, 25)} ${hours < 12 ? "AM" : "PM"}`;
};

const buildRmqRecord = (msg) => ({
	basicProperties: {
		contentType: msg.properties.contentType ?? null,
		contentEncoding: msg.properties.contentEncoding ?? null,
		headers: toLambdaHeaders(msg.properties.headers),
		deliveryMode: msg.properties.deliveryMode ?? 1,
		priority: msg.properties.priority ?? null,
		correlationId: msg.properties.correlationId ?? null,
		replyTo: msg.properties.replyTo ?? null,
		expiration: msg.properties.expiration ?? null,
		messageId: msg.properties.messageId ?? null,
		timestamp:
			msg.properties.timestamp === undefined
				? null
				: toLambdaTimestamp(msg.properties.timestamp),
		type: msg.properties.type ?? null,
		userId: msg.properties.userId ?? null,
		appId: msg.properties.appId ?? null,
		clusterId: msg.properties.clusterId ?? null,
		bodySize: msg.content.length,
	},
	redelivered: msg.fields.redelivered ?? false,
	data: msg.content.toString("base64"),
});

const noop = () => {};

export const pollRmq = (opts) => {
	pollRmqValidateOptions(opts);
	const queueKey = `${opts.queue}::${opts.vhost ?? "/"}`;
	const batcher = mqBatcher(opts);
	const prefetch = opts.prefetch ?? batcher.batchSize * 2;

	const connect = opts.connect ?? amqplib.connect;
	let connection = opts.connection;
	let channel = opts.channel;

	return {
		source: "aws:rmq",
		async *poll(signal, report = noop) {
			if (!connection) connection = await connect(opts.url);
			if (!channel) channel = await connection.createChannel();
			await channel.prefetch(prefetch);

			// A channel emits "close" when it or its connection closes, after
			// "error" when the server closed it with one; an unheard "error" would
			// throw out of amqplib's socket handler instead of reaching onError.
			// https://amqp-node.github.io/amqplib/channel_api.html#channel-events
			let closeError;
			channel.on("error", (err) => {
				closeError = err;
			});
			channel.once("close", () =>
				batcher.failPoll(
					closeError ??
						new Error("Channel closed", {
							cause: { package: pkg, data: { queue: opts.queue } },
						}),
				),
			);

			const { consumerTag } = await channel.consume(
				opts.queue,
				(msg) => {
					// RabbitMQ cancelled the consumer (queue deleted, node failover):
					// amqplib then invokes the callback with null.
					// https://amqp-node.github.io/amqplib/channel_api.html#channel_consume
					if (msg === null) {
						batcher.failPoll(
							new Error("Consumer cancelled by RabbitMQ", {
								cause: { package: pkg, data: { queue: opts.queue } },
							}),
						);
						return;
					}
					batcher.deliver(msg);
				},
				{ noAck: false },
			);

			// On abort only stop new deliveries and wake the reader: the batch in
			// flight still has to be acknowledged on this channel. A cancelled
			// consumer keeps its unacknowledged deliveries; closing the channel,
			// once the poll ends, requeues whatever is left.
			// https://www.rabbitmq.com/docs/consumers#consumer-cancellation
			const onAbort = async () => {
				batcher.wakeReader();
				try {
					await channel.cancel(consumerTag);
				} catch {
					// best-effort: the channel is closed in finally either way
				}
			};
			signal.addEventListener("abort", onAbort);

			try {
				// A failed batch is held and retried here rather than requeued: a
				// requeue would have RabbitMQ redeliver it at once. On shutdown,
				// closing the channel when the poll ends requeues unacknowledged
				// deliveries, as it does when the poll fails.
				// https://www.rabbitmq.com/docs/confirms
				// A batch held past RabbitMQ's delivery acknowledgement timeout (30
				// minutes by default, quorum queues only from RabbitMQ 4.3) is returned
				// to the queue and its consumer is cancelled or its channel closed,
				// which fails the poll.
				// https://www.rabbitmq.com/docs/consumers#acknowledgement-timeout
				yield* batcher.batches(signal, {
					toEvent: (batch) => ({
						eventSource: "aws:rmq",
						eventSourceArn: opts.eventSourceArn,
						rmqMessagesByQueue: {
							[queueKey]: batch.map(buildRmqRecord),
						},
					}),
					discard: (batch, event) => {
						report(
							new Error("Retry attempts exhausted", {
								cause: {
									package: pkg,
									data: {
										queue: opts.queue,
										deliveryTags: batch.map((msg) => msg.fields.deliveryTag),
									},
								},
							}),
							event,
						);
						// RabbitMQ dead-letters a delivery rejected without a requeue when
						// the queue has a dead-letter exchange, and drops it otherwise.
						// https://www.rabbitmq.com/docs/dlx
						for (const msg of batch) channel.nack(msg, false, false);
					},
				});
			} finally {
				signal.removeEventListener("abort", onAbort);
				// best-effort: either may already be closed
				await channel.close().catch(() => {});
				await connection.close().catch(() => {});
			}
		},
		async acknowledge(event) {
			for (const msg of batcher.acknowledge(event)) channel.ack(msg);
		},
	};
};

export default pollRmq;
