// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// The module object rather than a named import so a test's mock timers can
// intercept setTimeout; a named import binds the real function at load time.
import timers from "node:timers/promises";
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

const identifierFor = (msg) => String(msg.fields.deliveryTag);

// A batchItemFailures entry whose itemIdentifier is null, empty or names no
// record in the batch invalidates the whole response: Lambda then retries
// every record. `ids` is the failed set to act on (every record when the
// response is invalid) and `error` the reason to raise through onError.
// https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
const batchFailures = (response, knownIds) => {
	const ids = new Set();
	for (const entry of response?.batchItemFailures ?? []) {
		const itemIdentifier = entry?.itemIdentifier;
		if (!knownIds.has(itemIdentifier)) {
			return {
				ids: knownIds,
				error: new Error("Invalid batchItemFailures entry", {
					cause: { package: pkg, data: { itemIdentifier } },
				}),
			};
		}
		ids.add(itemIdentifier);
	}
	return { ids };
};

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
	let failure;

	const wakeReader = () => {
		resolveNext?.();
		resolveNext = undefined;
	};

	// A consumer that can no longer deliver would leave the loop parked
	// forever. Fail the poll instead: the worker reports it through onError,
	// exits 1 and the primary re-forks it.
	const fail = (err) => {
		failure = err;
		wakeReader();
	};

	return {
		source: "aws:rmq",
		async *poll(signal) {
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
				fail(
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
						fail(
							new Error("Consumer cancelled by RabbitMQ", {
								cause: { package: pkg, data: { queue: opts.queue } },
							}),
						);
						return;
					}
					pending.push(msg);
					wakeReader();
				},
				{ noAck: false },
			);

			// On abort only stop new deliveries and wake the reader: the batch in
			// flight still has to be acknowledged on this channel. A cancelled
			// consumer keeps its unacknowledged deliveries; closing the channel,
			// once the poll ends, requeues whatever is left.
			// https://www.rabbitmq.com/docs/consumers#consumer-cancellation
			const onAbort = async () => {
				wakeReader();
				try {
					await channel.cancel(consumerTag);
				} catch {
					// best-effort: the channel is closed in finally either way
				}
			};
			signal.addEventListener("abort", onAbort, { once: true });

			try {
				while (!signal.aborted) {
					if (failure) throw failure;
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
						await timers.setTimeout(Math.min(50, deadline - Date.now()));
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
					// The runner resumes here after acknowledging the batch, or after the
					// handler threw. A batch still in flight was never acknowledged:
					// requeue every delivery so it redelivers instead of holding the
					// prefetch window until the consumer stalls. On shutdown, closing the
					// channel when the poll ends requeues unacknowledged deliveries
					// instead, as it does when the poll fails.
					// https://www.rabbitmq.com/docs/confirms
					if (signal.aborted) return;
					if (failure) throw failure;
					const unsettled = inflight.get(event);
					if (unsettled) {
						inflight.delete(event);
						for (const msg of unsettled) channel.nack(msg, false, true);
					}
				}
			} finally {
				signal.removeEventListener("abort", onAbort);
				// best-effort: either may already be closed
				await channel.close().catch(() => {});
				await connection.close().catch(() => {});
			}
		},
		async acknowledge(event, response) {
			const taken = inflight.get(event) ?? [];
			inflight.delete(event);
			// An unknown or already settled batch has nothing left to validate.
			if (taken.length === 0) return;
			const failed = batchFailures(response, new Set(taken.map(identifierFor)));
			for (const msg of taken) {
				if (failed.ids.has(identifierFor(msg))) {
					channel.nack(msg, false, true);
				} else {
					channel.ack(msg);
				}
			}
			// An invalid response requeues every delivery (the whole batch is
			// retried, as from Lambda) and then raises the reason.
			if (failed.error) throw failed.error;
		},
	};
};

export default pollRmq;
