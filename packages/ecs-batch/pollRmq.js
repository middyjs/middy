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
// date-time string in UTC, e.g. "Jan 1, 1970, 12:33:41 AM". Some ICU builds
// put a narrow no-break space before AM/PM; normalise it to a plain space.
const timestampFormat = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "medium",
	timeZone: "UTC",
});
const toLambdaTimestamp = (seconds) =>
	// Stryker disable next-line StringLiteral: equivalent on this ICU build, which already emits a plain space before AM/PM; the replacement only matters where ICU inserts U+202F.
	timestampFormat.format(new Date(seconds * 1000)).replace(/\u202f/g, " ");

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
					// Stryker disable next-line OptionalChaining: equivalent; channel is assigned above before this listener is registered.
					await channel?.close();
					// Stryker disable next-line OptionalChaining: equivalent; connection is assigned above before this listener is registered.
					await connection?.close();
				} catch {
					// best-effort
				}
			};
			// Stryker disable next-line ObjectLiteral,BooleanLiteral: equivalent; an AbortSignal fires abort at most once, so `once` only releases the listener early.
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
					// Stryker disable next-line OptionalChaining: equivalent; every event in `inflight` came out of poll(), which assigns channel before it yields.
					channel?.nack(msg, false, true);
				} else {
					// Stryker disable next-line OptionalChaining: equivalent; every event in `inflight` came out of poll(), which assigns channel before it yields.
					channel?.ack(msg);
				}
			}
			// An invalid response requeues every delivery (the whole batch is
			// retried, as from Lambda) and then raises the reason.
			if (failed.error) throw failed.error;
		},
	};
};

export default pollRmq;
