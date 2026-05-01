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

const buildAmqRecord = (headers, body) => ({
	messageID: headers["message-id"],
	messageType: headers["amq-msg-type"] ?? "jms/text-message",
	timestamp: Number(headers.timestamp ?? Date.now()),
	deliveryMode: Number(headers.persistent === "true" ? 2 : 1),
	priority: Number(headers.priority ?? 4),
	destination: headers.destination,
	redelivered: headers.redelivered === "true",
	data: Buffer.from(body, "utf-8").toString("base64"),
	properties: {},
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
			signal.addEventListener("abort", onAbort, { once: true });

			client.subscribe(
				{ destination: opts.destination, ack: ackMode },
				(err, message) => {
					if (err) return;
					readBody(message).then(
						(body) => {
							pendingMessages.push({
								message,
								record: buildAmqRecord(message.headers, body),
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
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			const taken = inflight.get(event) ?? [];
			inflight.delete(event);
			for (const t of taken) {
				if (failed.has(t.record.messageID)) {
					client?.nack(t.message);
				} else {
					client?.ack(t.message);
				}
			}
		},
	};
};

export default pollAmq;
