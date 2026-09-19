// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// The module object rather than a named import so a test's mock timers can
// intercept setTimeout; a named import binds the real function at load time.
import timers from "node:timers/promises";
import { validateOptions } from "@middy/util";
import stompit from "stompit";

const pkg = "@middy/ecs-batch/pollAmq";

const optionSchema = {
	type: "object",
	properties: {
		connectOptions: { type: "object", additionalProperties: true },
		destination: { type: "string" },
		ackMode: { type: "string", enum: ["client", "client-individual"] },
		batchSize: { type: "integer", minimum: 1 },
		batchWindowMs: { type: "integer", minimum: 0 },
		client: { type: "object", additionalProperties: true },
		connect: { instanceof: "Function" },
		eventSourceArn: { type: "string" },
	},
	required: ["connectOptions", "destination"],
	additionalProperties: false,
};

export const pollAmqValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaultConnect = (connectOptions) =>
	new Promise((resolve, reject) => {
		stompit.connect(connectOptions, (err, client) => {
			if (err) reject(err);
			else resolve(client);
		});
	});

const readBody = (message) =>
	new Promise((resolve, reject) => {
		message.readString("utf-8", (err, body) => {
			if (err) reject(err);
			else resolve(body);
		});
	});

// ActiveMQ STOMP destinations are "/queue/<name>", "/topic/<name>", the
// "/temp-" and "/remote-temp-" variants; Lambda carries the physical name only.
const stompDestinationPrefix = /^\/(?:remote-)?(?:temp-)?(?:queue|topic)\//;

// Headers ActiveMQ's STOMP FrameTranslator puts on a MESSAGE frame, plus the
// STOMP protocol headers. Any other header is a JMS user property.
const stompStandardHeaders = new Set([
	"message-id",
	"destination",
	"correlation-id",
	"expires",
	"reply-to",
	"priority",
	"redelivered",
	"timestamp",
	"type",
	"subscription",
	"browser",
	"JMSXUserID",
	"original-destination",
	"persistent",
	"ack",
	"content-length",
	"content-type",
	"transformation",
	"transformation-error",
	"amq-msg-type",
	"receipt",
	"transaction",
]);

const toProperties = (headers) => {
	const properties = {};
	for (const [key, value] of Object.entries(headers)) {
		if (!stompStandardHeaders.has(key)) properties[key] = value;
	}
	return properties;
};

// Record fields per the Lambda ActiveMQ event; STOMP header names per
// ActiveMQ's FrameTranslator (JMSCorrelationID -> correlation-id,
// JMSExpiration -> expires, JMSReplyTo -> reply-to, JMSType -> type,
// JMSDeliveryMode -> persistent). brokerInTime and brokerOutTime are OpenWire
// broker statistics that STOMP frames never carry, so they are omitted.
// The developer guide example prints `correlationId`; the AWS-maintained event
// types (aws-lambda-go, aws-lambda-java-events, Powertools) all read
// `correlationID`, so that is the name emitted here.
// https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html
const buildAmqRecord = (headers, body, subscribedDestination) => ({
	messageID: headers["message-id"],
	messageType: headers["amq-msg-type"] ?? "jms/text-message",
	deliveryMode: headers.persistent === "true" ? 2 : 1,
	replyTo: headers["reply-to"] ?? null,
	type: headers.type ?? null,
	expiration: headers.expires ?? null,
	priority: Number(headers.priority ?? 4),
	correlationID: headers["correlation-id"] ?? null,
	redelivered: headers.redelivered === "true",
	destination: {
		physicalName: (headers.destination ?? subscribedDestination).replace(
			stompDestinationPrefix,
			"",
		),
	},
	data: Buffer.from(body).toString("base64"),
	timestamp: Number(headers.timestamp ?? Date.now()),
	properties: toProperties(headers),
});

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

export const pollAmq = (opts) => {
	pollAmqValidateOptions(opts);
	const ackMode = opts.ackMode ?? "client-individual";
	const batchSize = opts.batchSize ?? 10;
	const batchWindowMs = opts.batchWindowMs ?? 1000;
	const connect = opts.connect ?? defaultConnect;

	let client;
	const pendingMessages = [];
	const inflight = new WeakMap();
	let resolveNext;

	const wakeReader = () => {
		resolveNext?.();
		resolveNext = undefined;
	};

	return {
		source: "aws:amq",
		async *poll(signal) {
			client = opts.client ?? (await connect(opts.connectOptions));
			const onAbort = () => {
				wakeReader();
				try {
					client.disconnect();
				} catch {
					// best-effort
				}
			};
			signal.addEventListener("abort", onAbort, { once: true });

			client.subscribe(
				{ destination: opts.destination, ack: ackMode },
				(err, message) => {
					if (err) return;
					readBody(message).then(
						(body) => {
							pendingMessages.push({
								message,
								record: buildAmqRecord(message.headers, body, opts.destination),
							});
							wakeReader();
						},
						() => {
							client.nack(message);
						},
					);
				},
			);

			while (!signal.aborted) {
				if (pendingMessages.length === 0) {
					await new Promise((r) => {
						resolveNext = r;
					});
					continue;
				}
				const deadline = Date.now() + batchWindowMs;
				while (
					pendingMessages.length < batchSize &&
					Date.now() < deadline &&
					!signal.aborted
				) {
					await timers.setTimeout(Math.min(50, deadline - Date.now()));
				}
				if (signal.aborted) return;
				const taken = pendingMessages.splice(0, batchSize);
				const event = {
					eventSource: "aws:amq",
					eventSourceArn: opts.eventSourceArn,
					messages: taken.map((t) => t.record),
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
			const failed = batchFailures(
				response,
				new Set(taken.map((t) => t.record.messageID)),
			);
			for (const t of taken) {
				if (failed.ids.has(t.record.messageID)) {
					client.nack(t.message);
				} else {
					client.ack(t.message);
				}
			}
			// An invalid response nacks every message (the whole batch is
			// retried, as from Lambda) and then raises the reason.
			if (failed.error) throw failed.error;
		},
	};
};

export default pollAmq;
