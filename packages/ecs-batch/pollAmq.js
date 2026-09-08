// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { setTimeout as delay } from "node:timers/promises";
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
// Stryker disable next-line Regex: equivalent; ActiveMQ STOMP destinations always start with the prefix, so an unanchored match still lands at index 0.
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
	// Stryker disable next-line StringLiteral: equivalent; Buffer.from treats an empty encoding as utf-8.
	data: Buffer.from(body, "utf-8").toString("base64"),
	timestamp: Number(headers.timestamp ?? Date.now()),
	properties: toProperties(headers),
});

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
			// Stryker disable next-line ObjectLiteral,BooleanLiteral: equivalent; an AbortSignal fires abort at most once, so `once` only releases the listener early.
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
					await delay(Math.min(50, deadline - Date.now()));
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
			const failed = new Set(
				// Stryker disable next-line ArrayDeclaration: equivalent; the placeholder entry has no itemIdentifier, and every STOMP MESSAGE frame carries a message-id, so the lookup behaves as with an empty list.
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			const taken = inflight.get(event) ?? [];
			inflight.delete(event);
			for (const t of taken) {
				if (failed.has(t.record.messageID)) {
					// Stryker disable next-line OptionalChaining: equivalent; every event in `inflight` came out of poll(), which assigns client before it yields.
					client?.nack(t.message);
				} else {
					// Stryker disable next-line OptionalChaining: equivalent; every event in `inflight` came out of poll(), which assigns client before it yields.
					client?.ack(t.message);
				}
			}
		},
	};
};

export default pollAmq;
