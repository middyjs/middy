// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { inflateSync } from "node:zlib";
import { createError, validateOptions } from "@middy/util";

const name = "event-batch-parser";
const pkg = `@middy/${name}`;

// Cap on the decompressed size of any single Glue-framed record payload.
// Bounds zlib decompression to defend against compression-bomb DoS, since
// record payloads originate from external producers (Kafka/Kinesis/SQS/MQ).
const DEFAULT_MAX_DECOMPRESSED_BYTES = 10 * 1024 * 1024; // 10 MiB

const optionSchema = {
	type: "object",
	properties: {
		key: { instanceof: "Function" },
		value: { instanceof: "Function" },
		body: { instanceof: "Function" },
		data: { instanceof: "Function" },
		disableEventSourceError: { type: "boolean" },
		maxDecompressedBytes: { type: "integer", minimum: 1 },
	},
	additionalProperties: false,
};

export const eventBatchParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventBatchParserMiddleware = (opts = {}) => {
	const options = { ...opts };
	const maxDecompressedBytes =
		options.maxDecompressedBytes ?? DEFAULT_MAX_DECOMPRESSED_BYTES;
	const parserFields = ["key", "value", "body", "data"].filter(
		(f) => typeof options[f] === "function",
	);

	const eventBatchParserMiddlewareBefore = async (request) => {
		const eventSource = detectEventSource(request.event);
		const source = eventSource ? sources[eventSource] : undefined;

		if (!source) {
			if (options.disableEventSourceError) return;
			throw new Error("Unsupported event source", {
				cause: {
					package: pkg,
					data: eventSource ?? null,
				},
			});
		}

		// Resolve the accessor + parser for each configured field once per
		// invocation, validating that each field is supported by this source.
		// Hoisting this out of the per-record loop avoids re-looking-up
		// source.fields/options and re-allocating an inner iterator for every
		// record across the batch.
		const work = [];
		for (const field of parserFields) {
			const accessor = source.fields[field];
			if (!accessor) {
				throw new TypeError(
					`${pkg}: field "${field}" is not supported for event source "${eventSource}". Supported: ${Object.keys(source.fields).join(", ")}`,
				);
			}
			work.push({ field, accessor, parser: options[field] });
		}

		// Produce the parser payload per source (encoding is source-specific per
		// AWS docs; see the per-source notes below):
		//   text sources (SQS) deliver the value already decoded as a string with
		//     no Glue framing, so it is handed to the parser as-is.
		//   binary sources (Kafka/Kinesis/Firehose/MQ) are base64 BLOBs: decode to
		//     a Buffer and strip any Glue framing first.
		// Framing is kept off the record so it doesn't leak downstream; parsers
		// receive it as a fourth arg. The representation is fixed per source, so
		// the branch is resolved once here rather than for every record.
		const encoding = source.encoding;
		const text = encoding === "utf8";
		const records = source.getRecords(request.event);
		for (let r = 0; r < records.length; r += 1) {
			const record = records[r];
			for (let w = 0; w < work.length; w += 1) {
				const { field, accessor, parser } = work[w];
				const raw = accessor.get(record);
				if (raw == null) continue;
				let payload = raw;
				let framing;
				if (!text) {
					payload = Buffer.from(raw, encoding);
					framing = parseGlueFraming(payload, maxDecompressedBytes);
				}
				let parsed;
				try {
					// Skip `await` for sync parsers (parseJson, schema-bound
					// parseAvro/parseProtobuf bindings) — saves a microtask per
					// record across the batch. Only awaits when the parser
					// actually returns a thenable.
					parsed = parser(payload, record, request, framing);
					if (parsed !== null && typeof parsed?.then === "function") {
						parsed = await parsed;
					}
				} catch (err) {
					throw createError(422, "Invalid record payload", {
						cause: {
							package: pkg,
							source: eventSource,
							field,
							message: err.message,
						},
					});
				}
				accessor.set(record, parsed);
			}
		}
	};

	return {
		before: eventBatchParserMiddlewareBefore,
	};
};

// Each source returns a flat array of records (not a generator): the before
// loop indexes it directly, so a real array avoids the per-yield iterator-result
// allocation that dominated GC on large batches. The single-group fast path
// returns the source's own array uncopied; only multi-group events allocate.
const flattenGroups = (groups) => {
	if (groups.length === 1) return groups[0];
	const out = [];
	for (const group of groups) {
		for (const record of group) out.push(record);
	}
	return out;
};

const kafkaRecords = (event) =>
	flattenGroups(Object.values(event.records ?? {}));

const rmqRecords = (event) =>
	flattenGroups(Object.values(event.rmqMessagesByQueue ?? {}));

// Each entry: how to iterate records and per-logical-field accessor pairs.
// `value`, `body`, and `data` are internal aliases for the same payload field
// on every source — undocumented, but accepted so users can use whichever name
// reads naturally for their source. Accessors are fixed functions (not string
// paths) to keep property access static and avoid dynamic-key pollution risks.
const accKey = {
	get: (r) => r.key,
	set: (r, v) => {
		r.key = v;
	},
};
const accValue = {
	get: (r) => r.value,
	set: (r, v) => {
		r.value = v;
	},
};
const accBody = {
	get: (r) => r.body,
	set: (r, v) => {
		r.body = v;
	},
};
const accData = {
	get: (r) => r.data,
	set: (r, v) => {
		r.data = v;
	},
};
const accKinesisData = {
	get: (r) => r.kinesis?.data,
	set: (r, v) => {
		r.kinesis.data = v;
	},
};

// Each source declares its payload `encoding` so callers don't have to know
// the AWS contract. See AWS docs cited per entry:
//   base64 → `key`/`value`/`data` is a base64-encoded BLOB.
//   utf8   → the field is plain text as delivered by AWS.
const sources = {
	// MSK: "The event payload contains an array of messages…
	// base64-encoded message."
	// docs.aws.amazon.com/lambda/latest/dg/with-msk.html
	"aws:kafka": {
		getRecords: kafkaRecords,
		fields: { key: accKey, value: accValue, body: accValue, data: accValue },
		encoding: "base64",
	},
	SelfManagedKafka: {
		getRecords: kafkaRecords,
		fields: { key: accKey, value: accValue, body: accValue, data: accValue },
		encoding: "base64",
	},
	// Kinesis: `data` is base64.
	// docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html
	"aws:kinesis": {
		getRecords: (event) => event.Records ?? [],
		fields: {
			value: accKinesisData,
			body: accKinesisData,
			data: accKinesisData,
		},
		encoding: "base64",
	},
	// Kinesis Firehose: transform-records `data` is base64.
	// docs.aws.amazon.com/firehose/latest/dev/data-transformation.html
	"aws:lambda:events": {
		getRecords: (event) => event.records ?? [],
		fields: { value: accData, body: accData, data: accData },
		encoding: "base64",
	},
	// SQS: `body` is a plain string, delivered as-is by Lambda.
	// docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
	//   example: { "body": "Test message.", … }
	"aws:sqs": {
		getRecords: (event) => event.Records ?? [],
		fields: { value: accBody, body: accBody, data: accBody },
		encoding: "utf8",
	},
	// MQ (ActiveMQ): "retrieves the messages as a BLOB of bytes,
	// base64-encodes them into a single JSON payload."
	// docs.aws.amazon.com/lambda/latest/dg/with-mq.html
	"aws:amq": {
		getRecords: (event) => event.messages ?? [],
		fields: { value: accData, body: accData, data: accData },
		encoding: "base64",
	},
	// MQ (RabbitMQ): same paragraph as ActiveMQ — `data` is base64.
	// docs.aws.amazon.com/lambda/latest/dg/with-mq.html
	"aws:rmq": {
		getRecords: rmqRecords,
		fields: { value: accData, body: accData, data: accData },
		encoding: "base64",
	},
};

const detectEventSource = (event) => {
	if (typeof event?.eventSource === "string") return event.eventSource;
	const records = event?.Records ?? event?.records ?? event?.messages;
	if (Array.isArray(records) && records[0]?.eventSource) {
		return records[0].eventSource;
	}
	if (event?.rmqMessagesByQueue) return "aws:rmq";
	return undefined;
};

const decompress = (compressionByte, payload, maxOutputLength) => {
	if (compressionByte === 0x00) return payload;
	if (compressionByte === 0x05) {
		try {
			return inflateSync(payload, { maxOutputLength });
		} catch (err) {
			if (err?.code === "ERR_BUFFER_TOO_LARGE") {
				throw createError(413, "Decompressed payload exceeds cap", {
					cause: {
						package: pkg,
						maxDecompressedBytes: maxOutputLength,
					},
				});
			}
			throw err;
		}
	}
	throw new Error(
		`Unsupported Glue Schema Registry compression byte: 0x${compressionByte.toString(16).padStart(2, "0")}`,
	);
};

const parseGlueFraming = (buffer, maxDecompressedBytes) => {
	// 0x03 == Glue Header
	if (buffer.length >= 18 && buffer[0] === 0x03) {
		const uuidBytes = buffer.subarray(2, 18);
		const hex = uuidBytes.toString("hex");
		return {
			schemaVersionId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`,
			payload: decompress(buffer[1], buffer.subarray(18), maxDecompressedBytes),
		};
	}
	return { payload: buffer };
};

export default eventBatchParserMiddleware;
