// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { inflateSync } from "node:zlib";
import { createError, validateOptions } from "@middy/util";

const name = "event-batch-parser";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		key: { instanceof: "Function" },
		value: { instanceof: "Function" },
		body: { instanceof: "Function" },
		data: { instanceof: "Function" },
		glueSchemaRegistry: { type: "object", additionalProperties: true },
		disableEventSourceError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const eventBatchParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventBatchParserMiddleware = (opts = {}) => {
	const options = { ...opts };
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

		// Validate field config matches source's supported fields
		for (const field of parserFields) {
			if (!Object.hasOwn(source.fields, field)) {
				throw new TypeError(
					`${pkg}: field "${field}" is not supported for event source "${eventSource}". Supported: ${Object.keys(source.fields).join(", ")}`,
				);
			}
		}

		// First pass: decode base64, parse Glue framing, populate _payload + _schemaVersionId
		const records = [];
		const recordFieldBuffers = [];
		const uuids = new Set();
		for (const record of source.iterate(request.event)) {
			records.push(record);
			const fieldBuffers = {};
			for (const field of parserFields) {
				const recordPath = source.fields[field];
				const raw = getAtPath(record, recordPath);
				if (raw == null) {
					fieldBuffers[field] = null;
					continue;
				}
				const buffer = Buffer.from(raw, "base64");
				parseGlueFraming(record, buffer);
				fieldBuffers[field] = buffer;
				if (record._schemaVersionId) uuids.add(record._schemaVersionId);
			}
			recordFieldBuffers.push(fieldBuffers);
		}

		// Optional Glue Schema Registry chaining: resolve any UUIDs we discovered
		if (options.glueSchemaRegistry && uuids.size > 0) {
			const { resolveSchemaVersion } = await import(
				"@middy/glue-schema-registry"
			);
			await Promise.all(
				[...uuids].map((uuid) =>
					resolveSchemaVersion(uuid, options.glueSchemaRegistry, request),
				),
			);
		}

		// Second pass: run parsers
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			const fieldBuffers = recordFieldBuffers[i];
			for (const field of parserFields) {
				const buffer = fieldBuffers[field];
				if (buffer === null) continue;
				const parser = options[field];
				let parsed;
				try {
					parsed = await parser(buffer, record, request);
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
				const recordPath = source.fields[field];
				setAtPath(record, recordPath, parsed);
			}
		}
	};

	return {
		before: eventBatchParserMiddlewareBefore,
	};
};

const kafkaIter = function* (event) {
	for (const topicRecords of Object.values(event.records ?? {})) {
		for (const record of topicRecords) {
			yield record;
		}
	}
};

const arrayIter = function* (event, recordsKey) {
	for (const record of event[recordsKey] ?? []) {
		yield record;
	}
};

const rmqIter = function* (event) {
	for (const messages of Object.values(event.rmqMessagesByQueue ?? {})) {
		for (const message of messages) {
			yield message;
		}
	}
};

// Each entry: how to iterate records and which logical fields → record paths.
// `value`, `body`, and `data` are internal aliases for the same payload field
// on every source — undocumented, but accepted so users can use whichever name
// reads naturally for their source without us repeating mappings in three places.
const sources = {
	"aws:kafka": {
		iterate: (event) => kafkaIter(event),
		fields: { key: "key", value: "value", body: "value", data: "value" },
	},
	SelfManagedKafka: {
		iterate: (event) => kafkaIter(event),
		fields: { key: "key", value: "value", body: "value", data: "value" },
	},
	"aws:kinesis": {
		iterate: (event) => arrayIter(event, "Records"),
		fields: {
			value: "kinesis.data",
			body: "kinesis.data",
			data: "kinesis.data",
		},
	},
	// Kinesis Firehose
	"aws:lambda:events": {
		iterate: (event) => arrayIter(event, "records"),
		fields: { value: "data", body: "data", data: "data" },
	},
	"aws:sqs": {
		iterate: (event) => arrayIter(event, "Records"),
		fields: { value: "body", body: "body", data: "body" },
	},
	// MQ (ActiveMQ)
	"aws:amq": {
		iterate: (event) => arrayIter(event, "messages"),
		fields: { value: "data", body: "data", data: "data" },
	},
	// MQ (RabbitMQ)
	"aws:rmq": {
		iterate: (event) => rmqIter(event),
		fields: { value: "data", body: "data", data: "data" },
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

const getAtPath = (obj, path) => {
	if (!path.includes(".")) return obj[path];
	let cur = obj;
	for (const part of path.split(".")) {
		if (cur == null) return undefined;
		cur = cur[part];
	}
	return cur;
};

const setAtPath = (obj, path, value) => {
	if (!path.includes(".")) {
		obj[path] = value;
		return;
	}
	const parts = path.split(".");
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = value;
};

const decompress = (compressionByte, payload) => {
	if (compressionByte === 0x00) return payload;
	if (compressionByte === 0x05) return inflateSync(payload);
	throw new Error(
		`Unsupported Glue Schema Registry compression byte: 0x${compressionByte.toString(16).padStart(2, "0")}`,
	);
};

const parseGlueFraming = (record, buffer) => {
	// 0x03 == Glue Header
	if (buffer.length >= 18 && buffer[0] === 0x03) {
		const uuidBytes = buffer.subarray(2, 18);
		const hex = uuidBytes.toString("hex");
		record._schemaVersionId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
		record._payload = decompress(buffer[1], buffer.subarray(18));
	} else {
		record._payload = buffer;
	}
};

// ---------- Parser factories ----------

const fromInternal = (request, internalKey) => request.internal?.[internalKey];

export const parseJson =
	(parserOpts = {}) =>
	(buffer) =>
		JSON.parse(buffer.toString("utf-8"), parserOpts.reviver);

export const parseAvro = (parserOpts = {}) => {
	const internalKey = parserOpts.internalKey ?? pkg;
	if (parserOpts.schema) {
		// Lazy import: only loaded if user calls parseAvro with a static schema
		// before the middleware runs. We cache the type per-factory call.
		let typePromise;
		return async (buffer, record) => {
			typePromise ??= import("avro-js").then((m) =>
				m.default.parse(parserOpts.schema),
			);
			const type = await typePromise;
			return type.fromBuffer(record?._payload ?? buffer);
		};
	}
	return async (buffer, record, request) => {
		const slot = fromInternal(request, internalKey);
		const schemaDefinition =
			slot?.schemas?.get(record?._schemaVersionId)?.schemaDefinition ??
			slot?.schema;
		if (!schemaDefinition) {
			throw new TypeError(
				`parseAvro: no schema option supplied and request.internal["${internalKey}"] is unset`,
			);
		}
		const avro = await import("avro-js");
		return avro.default
			.parse(schemaDefinition)
			.fromBuffer(record?._payload ?? buffer);
	};
};

export const parseProtobuf = (parserOpts = {}) => {
	const internalKey = parserOpts.internalKey ?? pkg;
	if (parserOpts.root && parserOpts.messageType) {
		const Type = parserOpts.root.lookupType(parserOpts.messageType);
		return (buffer, record) => Type.decode(record?._payload ?? buffer).toJSON();
	}
	return (buffer, record, request) => {
		const slot = fromInternal(request, internalKey);
		const root = parserOpts.root ?? slot?.root;
		const messageType =
			slot?.schemas?.get(record?._schemaVersionId)?.messageType ??
			parserOpts.messageType ??
			slot?.messageType;
		if (!root || !messageType) {
			throw new TypeError(
				`parseProtobuf: no { root, messageType } supplied and request.internal["${internalKey}"] lacks them`,
			);
		}
		return root
			.lookupType(messageType)
			.decode(record?._payload ?? buffer)
			.toJSON();
	};
};

export default eventBatchParserMiddleware;
