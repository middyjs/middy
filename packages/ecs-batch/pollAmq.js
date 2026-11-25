// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { buffer } from "node:stream/consumers";
import { reservedPropertyNames, validateOptions } from "@middy/util";
import stompit from "stompit";
import { mqBatcher } from "./pollHelpers.js";

const pkg = "@middy/ecs-batch/pollAmq";

// "When delay is larger than 2147483647 or less than 1 or NaN, the delay will be set to 1."
// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
const int32 = { type: "integer", minimum: 0, maximum: 2_147_483_647 };
const portNumber = { type: "integer", minimum: 0, maximum: 65535 };
const hostName = { type: "string", maxLength: 1024, pattern: /^[\w.:%-]+$/u };
const visibleAscii = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
// "Commas or spaces are also acceptable separators but colons are normally used."
// https://docs.openssl.org/master/man1/openssl-ciphers/
const opensslText = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x20-\x7E]+$/u,
};
const credential = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
};
const pem = {
	type: "string",
	maxLength: 1_048_576,
	pattern: /^[\x20-\x7E\t\n\r]*$/u,
};
const bytes = { $ref: "#/$defs/Uint8Array" };
const pemOrBytes = { oneOf: [pem, bytes] };
const listOf = (items) => ({
	type: "array",
	items,
	maxItems: 1024,
	uniqueItems: true,
	unevaluatedItems: false,
});
const pemBundle = { oneOf: [pem, bytes, listOf(pemOrBytes)] };
const withPassphrase = (name) => ({
	type: "object",
	properties: { [name]: pemOrBytes, passphrase: credential },
	required: [name],
	additionalProperties: false,
	unevaluatedProperties: false,
});
const fn = { $ref: "#/$defs/Function" };
const instance = { $ref: "#/$defs/Object" };
const flag = { type: "boolean" };
const tlsVersion = {
	type: "string",
	enum: ["TLSv1.3", "TLSv1.2", "TLSv1.1", "TLSv1"],
};

// stompit.connect options, which it also hands to net.connect or tls.connect:
// node_modules/stompit/docs/sources/api/connect.md
// node_modules/@types/node/net.d.ts (TcpNetConnectOpts, IpcNetConnectOpts)
// node_modules/@types/node/tls.d.ts (ConnectionOptions)
const connectOptionsSchema = {
	type: "object",
	properties: {
		host: hostName,
		port: portNumber,
		timeout: int32,
		connectHeaders: {
			type: "object",
			propertyNames: visibleAscii,
			maxProperties: 1024,
			required: [],
			additionalProperties: {
				type: ["string", "number", "boolean"],
				maxLength: 1024,
				pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
				minimum: -Number.MAX_SAFE_INTEGER,
				maximum: Number.MAX_SAFE_INTEGER,
			},
			unevaluatedProperties: false,
		},
		// "Typical values are 107 bytes on Linux and 103 bytes on macOS."
		// https://nodejs.org/api/net.html#identifying-paths-for-ipc-connections
		path: { type: "string", maxLength: 107, pattern: /^[\x20-\x7E]+$/u },
		ssl: flag,
		connect: fn,
		heartbeatDelayMargin: int32,
		heartbeatOutputMargin: int32,
		localAddress: hostName,
		localPort: portNumber,
		hints: int32,
		// "Version of IP stack. Must be 4, 6, or 0."
		// https://nodejs.org/api/net.html#socketconnectoptions-connectlistener
		family: { type: "integer", enum: [0, 4, 6] },
		lookup: fn,
		autoSelectFamily: flag,
		autoSelectFamilyAttemptTimeout: int32,
		fd: int32,
		allowHalfOpen: flag,
		onread: {
			type: "object",
			properties: { buffer: { oneOf: [bytes, fn] }, callback: fn },
			required: ["buffer", "callback"],
			additionalProperties: false,
			unevaluatedProperties: false,
		},
		readable: flag,
		writable: flag,
		signal: { $ref: "#/$defs/AbortSignal" },
		noDelay: flag,
		keepAlive: flag,
		keepAliveInitialDelay: int32,
		blockList: instance,
		typeOfService: { type: "integer", minimum: 0, maximum: 255 },
		handle: instance,
		socket: instance,
		checkServerIdentity: fn,
		servername: hostName,
		session: bytes,
		minDHSize: int32,
		pskCallback: fn,
		secureContext: instance,
		enableTrace: flag,
		requestCert: flag,
		// "opaque ProtocolName<1..2^8-1>;"
		// https://www.rfc-editor.org/rfc/rfc7301#section-3.1
		ALPNProtocols: {
			oneOf: [
				listOf({ type: "string", maxLength: 255, pattern: /^[\x21-\x7E]+$/u }),
				bytes,
				{ $ref: "#/$defs/DataView" },
			],
		},
		SNICallback: fn,
		rejectUnauthorized: flag,
		requestOCSP: flag,
		ALPNCallback: fn,
		allowPartialTrustChain: flag,
		ca: pemBundle,
		cert: pemBundle,
		certificateCompression: listOf({
			type: "string",
			enum: ["zlib", "brotli", "zstd"],
		}),
		sigalgs: opensslText,
		ciphers: opensslText,
		clientCertEngine: opensslText,
		crl: pemBundle,
		dhparam: pemOrBytes,
		ecdhCurve: opensslText,
		honorCipherOrder: flag,
		key: {
			oneOf: [
				pem,
				bytes,
				listOf({ oneOf: [pem, bytes, withPassphrase("pem")] }),
			],
		},
		privateKeyEngine: opensslText,
		privateKeyIdentifier: opensslText,
		maxVersion: tlsVersion,
		minVersion: tlsVersion,
		passphrase: credential,
		pfx: {
			oneOf: [
				pem,
				bytes,
				listOf({ oneOf: [pem, bytes, withPassphrase("buf")] }),
			],
		},
		secureOptions: {
			type: "integer",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		secureProtocol: opensslText,
		sessionIdContext: opensslText,
		ticketKeys: bytes,
		sessionTimeout: int32,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:ecs-batch:pollAmq:options",
	$defs: {
		AbortSignal: false,
		DataView: false,
		Function: false,
		Object: false,
		Uint8Array: false,
	},
	type: "object",
	properties: {
		connectOptions: connectOptionsSchema,
		destination: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
		},
		ackMode: { type: "string", enum: ["client", "client-individual"] },
		// BatchSize and MaximumBatchingWindowInSeconds "from 0 seconds to 300 seconds":
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		batchSize: { type: "integer", minimum: 1, maximum: 10000 },
		batchWindowMs: { type: "integer", minimum: 0, maximum: 300_000 },
		client: { $ref: "#/$defs/Object" },
		connect: { $ref: "#/$defs/Function" },
		// EventSourceArn "arn:(aws[a-zA-Z0-9-]*):([a-zA-Z0-9\-])+:([a-z]{2}(-gov)?-[a-z]+-\d{1})?:(\d{12})?:(.*)":
		// https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html
		eventSourceArn: {
			type: "string",
			maxLength: 1024,
			pattern: /^arn:aws[\w-]*:[\w-]+:[\w-]*:(?:\d{12})?:[\x21-\x7E]+$/u,
		},
		maxRetryAttempts: { type: "integer", minimum: -1, maximum: 10000 },
		retryDelayMs: int32,
	},
	required: ["connectOptions", "destination"],
	additionalProperties: false,
	unevaluatedProperties: false,
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
	data: body.toString("base64"),
	timestamp: Number(headers.timestamp ?? Date.now()),
	properties: toProperties(headers),
});

const noop = () => {};

export const pollAmq = (opts) => {
	pollAmqValidateOptions(opts);
	const ackMode = opts.ackMode ?? "client-individual";
	const connect = opts.connect ?? defaultConnect;
	const batcher = mqBatcher(opts);
	let client;

	return {
		source: "aws:amq",
		async *poll(signal, report = noop) {
			client = opts.client ?? (await connect(opts.connectOptions));
			// stompit drops its connect-time "error" listener once connected, and
			// a dropped socket emits "error" on the client: unheard, it would be an
			// uncaught exception instead of reaching onError.
			client.on("error", batcher.failPoll);
			// On abort only wake the reader: the batch in flight still has to be
			// acknowledged on this connection. Disconnecting, once the poll ends,
			// leaves whatever is unacknowledged to the broker to redeliver.
			signal.addEventListener("abort", batcher.wakeReader);

			client.subscribe(
				{ destination: opts.destination, ack: ackMode },
				(err, message) => {
					if (err) {
						batcher.failPoll(err);
						return;
					}
					buffer(message).then((body) => {
						batcher.deliver({
							message,
							record: buildAmqRecord(message.headers, body, opts.destination),
						});
					}, batcher.failPoll);
				},
			);

			try {
				// A failed batch is held and retried here rather than NACKed:
				// ActiveMQ answers a STOMP NACK with a poison ack, which sends the
				// message to the dead-letter queue (and drops a non-persistent one)
				// instead of redelivering it. On shutdown or a failure,
				// disconnecting leaves the unacknowledged messages to the broker to
				// redeliver.
				// https://github.com/apache/activemq/blob/main/activemq-stomp/src/main/java/org/apache/activemq/transport/stomp/StompSubscription.java
				// https://activemq.apache.org/components/classic/documentation/message-redelivery-and-dlq-handling
				// https://stomp.github.io/stomp-specification-1.2.html#SUBSCRIBE_ack_Header
				yield* batcher.batches(signal, {
					toEvent: (batch) => ({
						eventSource: "aws:amq",
						eventSourceArn: opts.eventSourceArn,
						messages: batch.map((delivery) => delivery.record),
					}),
					discard: (batch, event) => {
						report(
							new Error("Retry attempts exhausted", {
								cause: {
									package: pkg,
									data: {
										messageIDs: batch.map(
											(delivery) => delivery.record.messageID,
										),
									},
								},
							}),
							event,
						);
						for (const delivery of batch) client.nack(delivery.message);
					},
				});
			} finally {
				signal.removeEventListener("abort", batcher.wakeReader);
				try {
					client.disconnect();
				} catch {
					// best-effort
				}
			}
		},
		async acknowledge(event) {
			for (const delivery of batcher.acknowledge(event)) {
				client.ack(delivery.message);
			}
		},
	};
};

export default pollAmq;
