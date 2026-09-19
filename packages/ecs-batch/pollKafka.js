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
		heartbeatIntervalMs: { type: "integer", minimum: 1 },
	},
	required: ["brokers", "groupId", "topics"],
	additionalProperties: false,
};

export const pollKafkaValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const noop = () => {};

// A Buffer is a Uint8Array; viewing either over its own memory encodes the
// same bytes without a copy.
const toBase64 = (val) => {
	if (val == null) return null;
	if (val instanceof Uint8Array) {
		return Buffer.from(val.buffer, val.byteOffset, val.byteLength).toString(
			"base64",
		);
	}
	return Buffer.from(String(val)).toString("base64");
};

const toBytes = (val) => {
	if (val instanceof Uint8Array) return Array.from(val);
	return Array.from(Buffer.from(String(val)));
};

// Lambda delivers headers as an array of single-key objects whose value is
// the raw header bytes, one entry per header value. kafkajs hands a header
// over as a Buffer, a string, an array of those, or undefined.
// https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html
const toLambdaHeaders = (headers) => {
	const out = [];
	for (const [key, value] of Object.entries(headers ?? {})) {
		if (value === undefined) continue;
		for (const v of Array.isArray(value) ? value : [value]) {
			out.push({ [key]: toBytes(v) });
		}
	}
	return out;
};

const buildKafkaRecord = (batch, message) => ({
	topic: batch.topic,
	partition: batch.partition,
	offset: Number(message.offset),
	timestamp: Number(message.timestamp),
	timestampType: "CREATE_TIME",
	key: toBase64(message.key),
	value: toBase64(message.value),
	headers: toLambdaHeaders(message.headers),
});

const buildKafkaEvent = (opts, eventSource, batch) => {
	const event = { eventSource };
	// MSK events carry the cluster ARN; SelfManagedKafka events do not.
	// https://docs.aws.amazon.com/lambda/latest/dg/with-kafka.html
	if (opts.eventSourceArn !== undefined) {
		event.eventSourceArn = opts.eventSourceArn;
	}
	event.bootstrapServers = opts.brokers.join(",");
	event.records = {
		[`${batch.topic}-${batch.partition}`]: batch.messages.map((m) =>
			buildKafkaRecord(batch, m),
		),
	};
	return event;
};

// Lambda's Kafka partial batch response identifies a failure as
// { partition: "topic-partition", offset } (what @middy/event-batch-response
// emits). The flat "topic-partition-offset" string form is still accepted.
// Both normalise to the key eachBatch uses per message.
// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
const failureKey = (itemIdentifier) =>
	itemIdentifier !== null && typeof itemIdentifier === "object"
		? `${itemIdentifier.partition}-${itemIdentifier.offset}`
		: itemIdentifier;
// A batchItemFailures entry whose itemIdentifier is null, empty or names no
// record in the batch invalidates the whole response: Lambda then retries
// every record. `ids` is the failed set to act on (every record when the
// response is invalid) and `error` the reason to raise through onError.
// https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
const batchFailures = (response, knownIds, toKey) => {
	const ids = new Set();
	for (const entry of response?.batchItemFailures ?? []) {
		const itemIdentifier = entry?.itemIdentifier;
		const key = toKey(itemIdentifier);
		if (!knownIds.has(key)) {
			return {
				ids: knownIds,
				error: new Error("Invalid batchItemFailures entry", {
					cause: { package: pkg, data: { itemIdentifier } },
				}),
			};
		}
		ids.add(key);
	}
	return { ids };
};

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
	const heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 3000;

	// Bridges kafkajs's push-mode eachBatch to the runner's pull loop. Only one
	// batch is in flight at a time (partitionsConsumedConcurrently=1) so a
	// single ack-gate per poller suffices.
	// Both settle a waitForEvent() promise. They start as no-ops so a batch or
	// abort that lands before the loop is parked (a non-retriable crash during
	// connect fails the first wait without arming them) has nothing to call.
	let resolveNext = noop;
	let rejectNext = noop;
	let resolveAck;
	let inflight = Promise.resolve();
	let inflightIds = new Set();
	let started = false;
	let crashError;

	const waitForEvent = () =>
		new Promise((resolve, reject) => {
			// A crash that landed while the runner held the previous batch.
			if (crashError) return reject(crashError);
			resolveNext = resolve;
			rejectNext = reject;
		});

	// kafkajs restarts the consumer itself after a retriable crash and emits
	// CRASH with `restart: true`. A non-retriable one (SASL authentication,
	// authorization) is emitted with `restart: false` and leaves the consumer
	// stopped, so the loop would park forever. Fail the poll instead: the
	// worker reports it through onError, exits 1 and the primary re-forks it.
	// https://kafka.js.org/docs/instrumentation-events#consumer
	const onCrash = ({ payload }) => {
		if (payload.restart) return;
		crashError = payload.error;
		rejectNext(crashError);
	};
	const waitForAck = () =>
		new Promise((r) => {
			resolveAck = r;
		});

	const recordId = (batch, m) =>
		`${batch.topic}-${batch.partition}-${m.offset}`;

	const handleBatch = async (
		{
			batch,
			resolveOffset,
			commitOffsetsIfNecessary,
			uncommittedOffsets,
			heartbeat,
		},
		signal,
	) => {
		if (signal.aborted) return;
		const event = buildKafkaEvent(opts, eventSource, batch);
		inflightIds = new Set(batch.messages.map((m) => recordId(batch, m)));
		const ackGate = waitForAck();
		resolveNext({ event, done: false });
		// The handler may outlast the group's session timeout. kafkajs only
		// heartbeats between eachBatch calls, so keep the session alive while
		// the batch is held; heartbeat() itself throttles to heartbeatInterval
		// and a rejection (rebalance in progress) surfaces on the commit instead.
		const beat = setInterval(
			() => heartbeat().catch(noop),
			heartbeatIntervalMs,
		).unref();
		let failed;
		try {
			failed = await ackGate;
		} finally {
			clearInterval(beat);
		}
		// Kafka commits are sequential per partition: stop at the first
		// failed offset so its native redelivery path stays intact.
		let resolved = 0;
		for (const m of batch.messages) {
			if (failed.has(recordId(batch, m))) break;
			resolveOffset(m.offset);
			resolved++;
		}
		// autoCommit is off, so the resolved offsets have to be handed to kafkajs
		// explicitly. A bare commitOffsetsIfNecessary() only commits when an
		// autoCommitInterval/autoCommitThreshold is configured.
		if (resolved > 0) await commitOffsetsIfNecessary(uncommittedOffsets());
		await heartbeat();
	};

	return {
		source: eventSource,
		consumer,
		async *poll(signal) {
			if (!started) {
				consumer.on(consumer.events.CRASH, onCrash);
				await consumer.connect();
				for (const topic of opts.topics) {
					await consumer.subscribe({
						topic,
						fromBeginning: opts.fromBeginning ?? false,
					});
				}
				started = true;
			}

			// Wake the loop so it observes the abort. A batch already handed to
			// the handler keeps its ack gate until the runner settles it.
			signal.addEventListener("abort", () => resolveNext({ done: true }), {
				once: true,
			});

			consumer.run({
				autoCommit: false,
				// kafkajs would otherwise resolve the batch's last offset after
				// eachBatch returns, committing past a failed record on the next
				// commit instead of redelivering it.
				eachBatchAutoResolve: false,
				partitionsConsumedConcurrently: 1,
				eachBatch: (payload) => {
					inflight = handleBatch(payload, signal);
					return inflight;
				},
			});

			try {
				while (!signal.aborted) {
					const next = await waitForEvent();
					if (next.done) return;
					// Only one batch is in flight, so both belong to the batch just
					// handed over.
					const release = resolveAck;
					const ids = inflightIds;
					yield next.event;
					// The runner resumes the generator after acknowledging, or after
					// the handler or acknowledge threw. An acknowledged gate ignores
					// this; an unacknowledged one is released with every record failed
					// so nothing resolves or commits and the batch redelivers from the
					// last committed offset. Without it eachBatch never returns and
					// kafkajs stops fetching and heartbeating.
					release(ids);
				}
			} finally {
				// Shutdown. A batch the runner acknowledged has already committed
				// through its gate; one it never acknowledged (handler threw) is
				// released with every record failed so nothing resolves or commits
				// and it redelivers from the last committed offset. Either way the
				// in-flight eachBatch settles before the consumer disconnects.
				resolveAck?.(inflightIds);
				await inflight.catch(() => {});
				try {
					await consumer.disconnect();
				} catch {
					// disconnect during shutdown is best-effort
				}
			}
		},
		async acknowledge(_event, response) {
			const failed = batchFailures(response, inflightIds, failureKey);
			// An invalid response releases the gate with every record failed, so
			// nothing resolves or commits and kafkajs fetches the batch again.
			resolveAck?.(failed.ids);
			if (failed.error) throw failed.error;
		},
	};
};

export default pollKafka;
