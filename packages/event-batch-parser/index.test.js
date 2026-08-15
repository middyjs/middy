import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import { clearCache } from "@middy/util";
import avro from "avro-js";
import { mockClient } from "aws-sdk-client-mock";
import protobuf from "protobufjs";
import middy from "../core/index.js";
import glueSchemaRegistry from "../glue-schema-registry/index.js";
import eventBatchParser, { eventBatchParserValidateOptions } from "./index.js";
import { parseAvro } from "./parseAvro.js";
import { parseJson } from "./parseJson.js";
import { parseProtobuf } from "./parseProtobuf.js";

test.afterEach(() => clearCache());

const defaultContext = { getRemainingTimeInMillis: () => 1000 };

const b64 = (s) => Buffer.from(s).toString("base64");
const plain = (v) => JSON.parse(JSON.stringify(v));

const AVRO_USER_SCHEMA = {
	type: "record",
	name: "User",
	fields: [
		{ name: "id", type: "string" },
		{ name: "name", type: "string" },
	],
};

const buildAvroBuffer = (value) => avro.parse(AVRO_USER_SCHEMA).toBuffer(value);

const buildProtobufRoot = () => {
	const root = new protobuf.Root();
	const Type = new protobuf.Type("User")
		.add(new protobuf.Field("id", 1, "string"))
		.add(new protobuf.Field("name", 2, "string"));
	root.define("test").add(Type);
	return root;
};

// ---------- validateOptions ----------

test("validateOptions accepts all parser fields", () => {
	eventBatchParserValidateOptions({
		key: () => undefined,
		value: () => undefined,
		body: () => undefined,
	});
});

test("validateOptions rejects non-function `data`", () => {
	let caught;
	try {
		eventBatchParserValidateOptions({ data: "not-a-function" });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("validateOptions accepts a function `data`", () => {
	eventBatchParserValidateOptions({ data: () => undefined });
});

test("validateOptions rejects non-boolean `disableEventSourceError`", () => {
	let caught;
	try {
		eventBatchParserValidateOptions({ disableEventSourceError: "yes" });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("validateOptions accepts a boolean `disableEventSourceError`", () => {
	eventBatchParserValidateOptions({ disableEventSourceError: true });
});

test("validateOptions rejects non-integer `maxDecompressedBytes`", () => {
	let caught;
	try {
		eventBatchParserValidateOptions({ maxDecompressedBytes: 1.5 });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("validateOptions rejects `maxDecompressedBytes` below minimum (0)", () => {
	let caught;
	try {
		eventBatchParserValidateOptions({ maxDecompressedBytes: 0 });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("validateOptions accepts a positive integer `maxDecompressedBytes`", () => {
	eventBatchParserValidateOptions({ maxDecompressedBytes: 1 });
});

test("validateOptions rejects unknown/extra options (additionalProperties false)", () => {
	let caught;
	try {
		eventBatchParserValidateOptions({ unknownOption: true });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("eventBatchParserValidateOptions actually validates (throws on invalid)", () => {
	// Guards against the validator body being replaced with a no-op.
	let caught;
	try {
		eventBatchParserValidateOptions({ value: 123 });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
});

// ---------- parseJson ----------

test("parseJson on Kafka value", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"my-topic-0": [{ topic: "t", partition: 0, value: b64('{"x":1}') }],
		},
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["my-topic-0"][0].value, { x: 1 });
});

test("parseJson on Kafka key+value", async () => {
	const handler = middy().use(
		eventBatchParser({ key: parseJson(), value: parseJson() }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ key: b64('"id-1"'), value: b64('{"a":2}') }],
		},
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].key, "id-1");
	deepStrictEqual(out.records["t-0"][0].value, { a: 2 });
});

test("parseJson across multiple Kafka topic-partition groups", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ value: b64('{"x":1}') }],
			"t-1": [{ value: b64('{"x":2}') }],
		},
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { x: 1 });
	deepStrictEqual(out.records["t-1"][0].value, { x: 2 });
});

test("parseJson on Kinesis data", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [
			{ eventSource: "aws:kinesis", kinesis: { data: b64('{"k":1}') } },
		],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.Records[0].kinesis.data, { k: 1 });
});

test("parseJson on Firehose data (real AWS shape: deliveryStreamArn, recordId, no eventSource)", async () => {
	// A real Kinesis Data Firehose data-transformation event has a top-level
	// deliveryStreamArn and records carrying recordId/data with NO eventSource.
	// docs.aws.amazon.com/firehose/latest/dev/data-transformation.html
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		invocationId: "inv-1",
		deliveryStreamArn: "arn:aws:firehose:us-east-1:123:deliverystream/x",
		region: "us-east-1",
		records: [{ recordId: "r-1", data: b64('{"f":1}') }],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records[0].data, { f: 1 });
});

test("parseJson on SQS body (plain text per AWS contract)", async () => {
	// SQS bodies are delivered as plain text by Lambda — see
	// docs.aws.amazon.com/lambda/latest/dg/with-sqs.html. The parser must
	// NOT base64-decode SQS bodies.
	const handler = middy().use(eventBatchParser({ body: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [{ eventSource: "aws:sqs", body: '{"s":1}' }],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.Records[0].body, { s: 1 });
});

test("parseJson on SQS body with characters that would mis-decode as base64", async () => {
	// Regression guard for the previous bug: `Buffer.from(body, "base64")` on
	// plain text was lenient (silently produced garbage). Ensures bodies
	// containing whitespace/punctuation parse intact.
	const handler = middy().use(eventBatchParser({ body: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [
			{
				eventSource: "aws:sqs",
				body: '{ "user_id": "abc-123", "amount": 42.5 }',
			},
		],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.Records[0].body, { user_id: "abc-123", amount: 42.5 });
});

test("parseJson on SelfManagedKafka", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "SelfManagedKafka",
		records: { "t-0": [{ value: b64('{"smk":1}') }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { smk: 1 });
});

test("parseJson on ActiveMQ (aws:amq)", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:amq",
		messages: [{ data: b64('{"mq":1}') }],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.messages[0].data, { mq: 1 });
});

test("parseJson on RabbitMQ", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:rmq",
		rmqMessagesByQueue: { q: [{ data: b64('{"r":1}') }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.rmqMessagesByQueue.q[0].data, { r: 1 });
});

// ---------- parseAvro static ----------

test("parseAvro({ schema }) decodes Kafka value", async () => {
	const buf = buildAvroBuffer({ id: "u-1", name: "Alice" });
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: buf.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-1",
		name: "Alice",
	});
});

test("parseAvro({ schema }) decodes Kinesis data", async () => {
	const buf = buildAvroBuffer({ id: "u-2", name: "Bob" });
	const handler = middy().use(
		eventBatchParser({ data: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		Records: [
			{
				eventSource: "aws:kinesis",
				kinesis: { data: buf.toString("base64") },
			},
		],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.Records[0].kinesis.data), {
		id: "u-2",
		name: "Bob",
	});
});

// ---------- parseProtobuf static ----------

test("parseProtobuf({ root, messageType }) decodes Kafka value", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-3", name: "Carol" })).finish();
	const handler = middy().use(
		eventBatchParser({
			value: parseProtobuf({ root, messageType: "test.User" }),
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ value: Buffer.from(buf).toString("base64") }],
		},
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { id: "u-3", name: "Carol" });
});

// ---------- internalKey fallback (glue-schema-registry fetchData entry) ----------

test("parseAvro({ internalKey }) reads schemaDefinition from internal", async () => {
	const buf = buildAvroBuffer({ id: "u-4", name: "Dave" });
	const stubRegistry = () => ({
		before: (request) => {
			request.internal.userSchema = {
				schemaVersionId: "00000000-0000-0000-0000-000000000000",
				schemaDefinition: AVRO_USER_SCHEMA,
				dataFormat: "AVRO",
			};
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseAvro({ internalKey: "userSchema" }) }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: buf.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-4",
		name: "Dave",
	});
});

// ---------- Glue framing ----------

const glueFramedBuffer = (uuid, payload, compressionByte = 0x00) => {
	const hex = uuid.replace(/-/g, "");
	const uuidBytes = Buffer.from(hex, "hex");
	const compressed = compressionByte === 0x05 ? deflateSync(payload) : payload;
	return Buffer.concat([
		Buffer.from([0x03, compressionByte]),
		uuidBytes,
		compressed,
	]);
};

test("Glue framing: parses framing and uses static schema", async () => {
	const inner = buildAvroBuffer({ id: "u-6", name: "Faye" });
	const uuid = "12345678-1234-1234-1234-1234567890ab";
	const framed = glueFramedBuffer(uuid, inner);

	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-6",
		name: "Faye",
	});
});

test("Glue framing: zlib-compressed (0x05) payload is inflated", async () => {
	const inner = buildAvroBuffer({ id: "u-7", name: "Gus" });
	const uuid = "abcdef01-1234-1234-1234-1234567890ab";
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-7",
		name: "Gus",
	});
});

test("Non-Glue-framed records pass through untouched (first byte != 0x03)", async () => {
	const buf = buildAvroBuffer({ id: "u-8", name: "Hugo" });
	// Avro starts with field bytes, not 0x03 in this case
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: buf.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-8",
		name: "Hugo",
	});
});

// ---------- Errors ----------

test("body is an internal alias for value on Kafka", async () => {
	const handler = middy().use(eventBatchParser({ body: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64('{"x":1}') }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { x: 1 });
});

test("Mismatched config: key for Kinesis throws TypeError carrying cause.package", async () => {
	const handler = middy().use(eventBatchParser({ key: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [
			{ eventSource: "aws:kinesis", kinesis: { data: b64('{"x":1}') } },
		],
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("Unknown event source throws", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	let caught;
	try {
		await handler({ Records: [{ eventSource: "aws:weird" }] }, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.message, "Unsupported event source");
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
});

test("Glue framing: decompressed payload over cap throws 413", async () => {
	const uuid = "11112222-1234-1234-1234-1234567890ab";
	// 1 MiB of zeros deflates to ~1 KiB; with a 1 KiB cap it must reject.
	const inner = Buffer.alloc(1024 * 1024, 0);
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(
		eventBatchParser({
			value: parseJson(),
			maxDecompressedBytes: 1024,
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 413);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
	strictEqual(caught.cause.maxDecompressedBytes, 1024);
});

test("Glue framing: decompressed payload under cap succeeds", async () => {
	const uuid = "22223333-1234-1234-1234-1234567890ab";
	const inner = Buffer.from("hello");
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(
		eventBatchParser({
			value: (_buffer, _record, _request, framing) =>
				framing.payload.toString("utf-8"),
			maxDecompressedBytes: 64 * 1024,
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].value, "hello");
});

test("Glue framing: malformed deflate stream rethrows underlying zlib error", async () => {
	const uuid = "33334444-1234-1234-1234-1234567890ab";
	const hex = uuid.replace(/-/g, "");
	const uuidBytes = Buffer.from(hex, "hex");
	// 0x05 marks zlib but the bytes that follow are not a valid deflate stream.
	const framed = Buffer.concat([
		Buffer.from([0x03, 0x05]),
		uuidBytes,
		Buffer.from([0xff, 0xff, 0xff, 0xff]),
	]);
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	// Not an HTTP 413; the cap wasn't breached, the stream was malformed.
	strictEqual(caught.statusCode, undefined);
});

test("Glue framing: unsupported compression byte throws", async () => {
	const uuid = "fedcba98-1234-1234-1234-1234567890ab";
	const hex = uuid.replace(/-/g, "");
	const uuidBytes = Buffer.from(hex, "hex");
	const framed = Buffer.concat([
		Buffer.from([0x03, 0x99]),
		uuidBytes,
		Buffer.from("payload"),
	]);
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	await rejects(() => handler(event, defaultContext), /0x99/);
});

test("parseAvro() throws TypeError when no schema and no internalKey supplied", async () => {
	let caught;
	try {
		parseAvro();
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	ok(
		caught.message.includes("schema") || caught.message.includes("internalKey"),
	);
});

test("parseProtobuf({ root, messageType }) decodes a record", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-9", name: "Ivy" })).finish();

	const handler = middy().use(
		eventBatchParser({
			value: parseProtobuf({ root, messageType: "test.User" }),
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ value: Buffer.from(buf).toString("base64") }],
		},
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { id: "u-9", name: "Ivy" });
});

test("parseProtobuf({ internalKey }) reads { root, messageType } from internal", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-10", name: "Jay" })).finish();

	const stubRegistry = () => ({
		before: (request) => {
			request.internal.userProto = { root, messageType: "test.User" };
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(
			eventBatchParser({ value: parseProtobuf({ internalKey: "userProto" }) }),
		);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: Buffer.from(buf).toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { id: "u-10", name: "Jay" });
});

test("parseProtobuf() throws when neither factory nor internal supplies root+messageType", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-11", name: "Kim" })).finish();

	const handler = middy().use(
		eventBatchParser({ value: parseProtobuf({ internalKey: "missing" }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: Buffer.from(buf).toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 422);
	ok(caught.cause.message.includes("missing"));
});

test("Kafka event with no records falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:kafka" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("SQS event with no Records falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ body: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:sqs" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("Kinesis event with no Records falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:kinesis" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("Firehose event with no records falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:lambda:events" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("ActiveMQ event with no messages falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:amq" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("RMQ event with no rmqMessagesByQueue falls back to empty iterator", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:rmq" };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, event);
});

test("RMQ event detected by rmqMessagesByQueue (no eventSource)", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { rmqMessagesByQueue: { q: [{ data: b64('{"r":2}') }] } };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out.rmqMessagesByQueue.q[0].data, { r: 2 });
});

test("getAtPath returns undefined when intermediate is null (kinesis = null)", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [{ eventSource: "aws:kinesis", kinesis: null }],
	};
	const out = await handler(event, defaultContext);
	strictEqual(out.Records[0].kinesis, null);
});

test("disableEventSourceError silently skips unknown source", async () => {
	const handler = middy().use(
		eventBatchParser({
			value: parseJson(),
			disableEventSourceError: true,
		}),
	);
	handler.handler((event) => event);

	const out = await handler({ foo: "bar" }, defaultContext);
	deepStrictEqual(out, { foo: "bar" });
});

test("parseAvro({ schema }) caches type across multiple records", async () => {
	const buf = buildAvroBuffer({ id: "u-c", name: "Cathy" });
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [
				{ value: buf.toString("base64") },
				{ value: buf.toString("base64") },
			],
		},
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-c",
		name: "Cathy",
	});
	deepStrictEqual(plain(out.records["t-0"][1].value), {
		id: "u-c",
		name: "Cathy",
	});
});

test("parseAvro({ schema }) decodes a Glue-framed payload via _payload", async () => {
	const inner = buildAvroBuffer({ id: "u-g", name: "Gail" });
	const uuid = "33333333-4444-5555-6666-777777777777";
	const framed = glueFramedBuffer(uuid, inner);
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ schema: AVRO_USER_SCHEMA }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-g",
		name: "Gail",
	});
});

test("parseAvro/parseProtobuf/parseJson accept buffer-only call (no record/framing args)", () => {
	const avroBuf = buildAvroBuffer({ id: "z", name: "Z" });
	const fnAvroStatic = parseAvro({ schema: AVRO_USER_SCHEMA });
	deepStrictEqual(plain(fnAvroStatic(avroBuf)), { id: "z", name: "Z" });

	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const protoBuf = Buffer.from(
		Type.encode(Type.create({ id: "p", name: "P" })).finish(),
	);
	const fnProtoStatic = parseProtobuf({ root, messageType: "test.User" });
	deepStrictEqual(fnProtoStatic(protoBuf), { id: "p", name: "P" });

	const fnJson = parseJson();
	deepStrictEqual(fnJson(Buffer.from('{"j":1}')), { j: 1 });
});

test("parseAvro({ internalKey }) async-throws when entry missing on request.internal", async () => {
	const buf = buildAvroBuffer({ id: "u-na", name: "NA" });
	const handler = middy().use(
		eventBatchParser({ value: parseAvro({ internalKey: "missingSchema" }) }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: buf.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 422);
	ok(caught.cause.message.includes("missingSchema"));
});

test("parseAvro({ internalKey }) direct call covers buffer-only and missing-internal branches", async () => {
	const buf = buildAvroBuffer({ id: "u-d", name: "D" });
	const fn = parseAvro({ internalKey: "k" });

	// request.internal absent (?. short-circuit) → throws TypeError mentioning k
	let caught;
	try {
		await fn(buf, undefined, {});
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	ok(caught.message.includes('"k"'));

	// entry present without schemaDefinition → throws
	let caught2;
	try {
		await fn(buf, undefined, { internal: { k: { foo: 1 } } });
	} catch (e) {
		caught2 = e;
	}
	ok(caught2 instanceof TypeError);

	// entry has schemaDefinition, no framing arg → uses `?? buffer` branch
	const out = await fn(buf, undefined, {
		internal: { k: { schemaDefinition: AVRO_USER_SCHEMA } },
	});
	deepStrictEqual(plain(out), { id: "u-d", name: "D" });
});

test("parseProtobuf() direct call covers buffer-only and missing branches", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const protoBuf = Buffer.from(
		Type.encode(Type.create({ id: "x", name: "X" })).finish(),
	);

	// internalKey set but request.internal missing → throws
	const fn = parseProtobuf({ internalKey: "k" });
	let caught;
	try {
		await fn(protoBuf, undefined, {});
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);

	// entry has root but no messageType → still throws
	const fn2 = parseProtobuf({ internalKey: "k" });
	let caught2;
	try {
		await fn2(protoBuf, undefined, { internal: { k: { root } } });
	} catch (e) {
		caught2 = e;
	}
	ok(caught2 instanceof TypeError);

	// entry has both → succeeds, exercises buffer-only (no framing) path
	const fn3 = parseProtobuf({ internalKey: "k" });
	const out = await fn3(protoBuf, undefined, {
		internal: { k: { root, messageType: "test.User" } },
	});
	deepStrictEqual(out, { id: "x", name: "X" });
});

test("parseProtobuf() with no internalKey and no static config async-throws", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-q", name: "Q" })).finish();

	const handler = middy().use(eventBatchParser({ value: parseProtobuf() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: Buffer.from(buf).toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 422);
});

test("Unknown source with no eventSource (data: null) throws", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	let caught;
	try {
		await handler({ Records: [{}] }, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.message, "Unsupported event source");
	strictEqual(caught.cause.data, null);
});

test("parseProtobuf({ root, messageType }) decodes a Glue-framed payload via _payload", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const inner = Type.encode(Type.create({ id: "u-pg", name: "Pete" })).finish();
	const uuid = "44444444-5555-6666-7777-888888888888";
	const framed = glueFramedBuffer(uuid, Buffer.from(inner));

	const handler = middy().use(
		eventBatchParser({
			value: parseProtobuf({ root, messageType: "test.User" }),
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { id: "u-pg", name: "Pete" });
});

test("Records with missing parser field are skipped (raw == null)", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [
				{ topic: "t", partition: 0 }, // no `value`
				{ topic: "t", partition: 0, value: b64('{"x":1}') },
			],
		},
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].value, undefined);
	deepStrictEqual(out.records["t-0"][1].value, { x: 1 });
});

test("End-to-end: glueSchemaRegistry feeds parseAvro({ internalKey })", async () => {
	mockClient(GlueClient)
		.on(GetSchemaVersionCommand)
		.resolves({
			SchemaVersionId: "22222222-3333-4444-5555-666666666666",
			SchemaDefinition: JSON.stringify(AVRO_USER_SCHEMA),
			DataFormat: "AVRO",
		});

	const inner = buildAvroBuffer({ id: "u-12", name: "Lou" });
	const uuid = "22222222-3333-4444-5555-666666666666";
	const framed = glueFramedBuffer(uuid, inner);

	const handler = middy()
		.use(
			glueSchemaRegistry({
				AwsClient: GlueClient,
				fetchData: { userSchema: { SchemaVersionId: uuid } },
				disablePrefetch: true,
				cacheExpiry: 0,
			}),
		)
		.use(
			eventBatchParser({
				value: parseAvro({ internalKey: "userSchema" }),
			}),
		);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-12",
		name: "Lou",
	});
});

test("Parser throw wraps in 422", async () => {
	const handler = middy().use(
		eventBatchParser({
			value: () => {
				throw new Error("boom");
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64("garbage") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 422);
	strictEqual(caught.cause.package, "@middy/event-batch-parser");
	strictEqual(caught.cause.field, "value");
});

// ---------- default decompression cap (10 MiB) ----------

test("default maxDecompressedBytes allows a ~1 MiB payload (cap is 10 MiB, not smaller)", async () => {
	// No maxDecompressedBytes option: the default 10 * 1024 * 1024 cap must
	// apply. A ~1 MiB inflated payload is well under 10 MiB and must succeed.
	// Any shrunk default (e.g. 10*1024/1024 = 10240, or 10/1024*1024 ≈ 10)
	// would reject this with a 413.
	const uuid = "55556666-1234-1234-1234-1234567890ab";
	const inner = Buffer.alloc(1024 * 1024, 0); // 1 MiB
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(
		eventBatchParser({
			value: (_buffer, _record, _request, framing) => framing.payload.length,
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].value, 1024 * 1024);
});

test("default maxDecompressedBytes rejects a payload over 10 MiB with 413", async () => {
	// A payload just over the 10 MiB default cap must be rejected when no
	// maxDecompressedBytes option is supplied.
	const uuid = "66667777-1234-1234-1234-1234567890ab";
	const inner = Buffer.alloc(10 * 1024 * 1024 + 1, 0); // 10 MiB + 1 byte
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 413);
	strictEqual(caught.cause.maxDecompressedBytes, 10 * 1024 * 1024);
});

// ---------- error message text ----------

test("Unsupported-field TypeError carries the exact message and comma-joined field list", async () => {
	const handler = middy().use(eventBatchParser({ key: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [
			{ eventSource: "aws:kinesis", kinesis: { data: b64('{"x":1}') } },
		],
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	strictEqual(
		caught.message,
		'@middy/event-batch-parser: field "key" is not supported for event source "aws:kinesis". Supported: value, body, data',
	);
});

test("Parser-throw 422 carries the exact 'Invalid record payload' message", async () => {
	const handler = middy().use(
		eventBatchParser({
			value: () => {
				throw new Error("boom");
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64("garbage") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.message, "Invalid record payload");
});

test("413 over-cap error carries the exact 'Decompressed payload exceeds cap' message", async () => {
	const uuid = "77778888-1234-1234-1234-1234567890ab";
	const inner = Buffer.alloc(1024 * 1024, 0);
	const framed = glueFramedBuffer(uuid, inner, 0x05);

	const handler = middy().use(
		eventBatchParser({ value: parseJson(), maxDecompressedBytes: 1024 }),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.message, "Decompressed payload exceeds cap");
});

test("Unsupported compression byte message hex-pads to two digits (0x07)", async () => {
	// 0x07 < 0x10, so padStart(2, "0") yields "07"; padStart(2, "") yields "7".
	const uuid = "88889999-1234-1234-1234-1234567890ab";
	const hex = uuid.replace(/-/g, "");
	const uuidBytes = Buffer.from(hex, "hex");
	const framed = Buffer.concat([
		Buffer.from([0x03, 0x07]),
		uuidBytes,
		Buffer.from("payload"),
	]);
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(
		caught.message,
		"Unsupported Glue Schema Registry compression byte: 0x07",
	);
});

// ---------- text vs binary path (SQS) ----------

test("SQS (text source) hands the raw string to the parser, not a Buffer", async () => {
	// Text sources must skip Buffer decoding and Glue framing: the parser's
	// `payload` arg is the original string and there is no `framing` arg.
	let observedPayload;
	let observedFraming = "unset";
	const handler = middy().use(
		eventBatchParser({
			body: (payload, _record, _request, framing) => {
				observedPayload = payload;
				observedFraming = framing;
				return JSON.parse(payload);
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		Records: [{ eventSource: "aws:sqs", body: '{"s":1}' }],
	};

	const out = await handler(event, defaultContext);
	strictEqual(typeof observedPayload, "string");
	strictEqual(observedPayload, '{"s":1}');
	strictEqual(observedFraming, undefined);
	deepStrictEqual(out.Records[0].body, { s: 1 });
});

test("Kafka (binary source) hands a Buffer payload plus framing to the parser", async () => {
	// Contrast to the SQS text path: binary sources decode to a Buffer and
	// always pass a `framing` object (with at least `payload`).
	let observedPayload;
	let observedFraming;
	const handler = middy().use(
		eventBatchParser({
			value: (payload, _record, _request, framing) => {
				observedPayload = payload;
				observedFraming = framing;
				return JSON.parse(payload.toString("utf-8"));
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64('{"x":1}') }] },
	};

	await handler(event, defaultContext);
	ok(Buffer.isBuffer(observedPayload));
	ok(observedFraming && Buffer.isBuffer(observedFraming.payload));
});

// ---------- await branching (line 104) ----------

test("parser returning undefined is set without error (optional chaining on .then)", async () => {
	// `undefined !== null` passes the left guard, so `parsed?.then` is accessed;
	// without optional chaining `undefined.then` would throw and wrap as 422.
	const handler = middy().use(eventBatchParser({ value: () => undefined }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64('{"x":1}') }] },
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].value, undefined);
});

test("async parser (thenable) is awaited so the resolved value is stored", async () => {
	const handler = middy().use(
		eventBatchParser({
			value: (payload) =>
				Promise.resolve(JSON.parse(payload.toString("utf-8")).x + 100),
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: b64('{"x":1}') }] },
	};

	const out = await handler(event, defaultContext);
	strictEqual(out.records["t-0"][0].value, 101);
});

// ---------- flattenGroups (single vs multi group) ----------

test("single Kafka group returns the source array uncopied (identity preserved)", async () => {
	const recordsArr = [{ value: b64('{"x":1}') }];
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": recordsArr },
	};

	const out = await handler(event, defaultContext);
	// Same array reference flattened through (single-group fast path).
	strictEqual(out.records["t-0"], recordsArr);
	deepStrictEqual(out.records["t-0"][0].value, { x: 1 });
});

test("multi-group Kafka flattens exactly the input records (no extra/sentinel entries)", async () => {
	const handler = middy().use(eventBatchParser({ value: parseJson() }));
	handler.handler((event) => {
		// Count total records actually processed across all groups.
		const total = Object.values(event.records).reduce(
			(n, g) => n + g.length,
			0,
		);
		return { total };
	});

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ value: b64('{"x":1}') }, { value: b64('{"x":2}') }],
			"t-1": [{ value: b64('{"x":3}') }],
		},
	};

	const out = await handler(event, defaultContext);
	// Exactly 3 records flattened+parsed; a sentinel/extra accumulator entry
	// would surface as a parse failure (422) on the bogus record.
	strictEqual(out.total, 3);
	deepStrictEqual(event.records["t-0"][0].value, { x: 1 });
	deepStrictEqual(event.records["t-0"][1].value, { x: 2 });
	deepStrictEqual(event.records["t-1"][0].value, { x: 3 });
});

// ---------- Kinesis empty-records fallback ----------

test("Kinesis event with no Records is returned untouched (empty fallback, no injected records)", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = { eventSource: "aws:kinesis" };
	const out = await handler(event, defaultContext);
	// Exact equality: the [] fallback must not introduce a Records array
	// (a non-empty fallback would add records and/or error on them).
	deepStrictEqual(out, { eventSource: "aws:kinesis" });
	strictEqual(out.Records, undefined);
});

// ---------- Glue framing header guard + UUID + payload ----------

test("Glue framing: schemaVersionId is the hyphenated UUID derived from header bytes", async () => {
	// Build a clean, known UUID and assert the exact parsed schemaVersionId.
	// Each hyphenated segment is distinct so a wrong slice surfaces.
	const knownUuid = "01234567-89ab-cdef-0011-223344556677";
	let observedFraming;
	const inner = Buffer.from("hi");
	const framed = glueFramedBuffer(knownUuid, inner);

	const handler = middy().use(
		eventBatchParser({
			value: (_payload, _record, _request, framing) => {
				observedFraming = framing;
				return framing.payload.toString("utf-8");
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	strictEqual(observedFraming.schemaVersionId, knownUuid);
	strictEqual(out.records["t-0"][0].value, "hi");
});

test("Glue framing: a buffer with first byte != 0x03 is treated as unframed (payload === original buffer)", async () => {
	let observedFraming;
	// First byte 0x01 (not the Glue 0x03 magic), length > 18.
	const raw = Buffer.concat([Buffer.from([0x01]), Buffer.alloc(30, 0x41)]);
	const handler = middy().use(
		eventBatchParser({
			value: (payload, _record, _request, framing) => {
				observedFraming = framing;
				return { isOriginal: framing.payload === payload };
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: raw.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	// Unframed: no schemaVersionId, payload is the original decoded buffer.
	strictEqual(observedFraming.schemaVersionId, undefined);
	ok(Buffer.isBuffer(observedFraming.payload));
	strictEqual(out.records["t-0"][0].value.isOriginal, true);
});

test("Glue framing: a buffer shorter than 18 bytes is treated as unframed even if it starts with 0x03", async () => {
	let observedFraming;
	// Starts with 0x03 but is only 10 bytes (< 18 header minimum).
	const raw = Buffer.concat([Buffer.from([0x03]), Buffer.alloc(9, 0x00)]);
	const handler = middy().use(
		eventBatchParser({
			value: (_payload, _record, _request, framing) => {
				observedFraming = framing;
				return framing.payload.length;
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: raw.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	// Not framed: no schemaVersionId, whole 10-byte buffer is the payload.
	strictEqual(observedFraming.schemaVersionId, undefined);
	strictEqual(out.records["t-0"][0].value, 10);
});

test("Glue framing: an exactly-18-byte 0x03-prefixed buffer IS framed (empty payload)", async () => {
	let observedFraming;
	const knownUuid = "aabbccdd-eeff-0011-2233-445566778899";
	const hex = knownUuid.replace(/-/g, "");
	const uuidBytes = Buffer.from(hex, "hex"); // 16 bytes
	// 0x03 magic + 0x00 (no compression) + 16 UUID bytes = exactly 18 bytes.
	const raw = Buffer.concat([Buffer.from([0x03, 0x00]), uuidBytes]);
	strictEqual(raw.length, 18);

	const handler = middy().use(
		eventBatchParser({
			value: (_payload, _record, _request, framing) => {
				observedFraming = framing;
				return framing.payload.length;
			},
		}),
	);
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: raw.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	// Boundary: length >= 18 (not > 18) so it must be framed.
	strictEqual(observedFraming.schemaVersionId, knownUuid);
	strictEqual(out.records["t-0"][0].value, 0);
});

// ---------- detectEventSource optional-chaining safety ----------

test("null event is handled safely (optional chaining on event accessors)", async () => {
	// detectEventSource reads event?.eventSource / event?.Records /
	// event?.deliveryStreamArn / event?.rmqMessagesByQueue. A null event must
	// not throw; without the optional chaining each access would throw.
	const handler = middy().use(
		eventBatchParser({ value: parseJson(), disableEventSourceError: true }),
	);
	handler.handler((event) => event ?? "was-null");

	const out = await handler(null, defaultContext);
	strictEqual(out, "was-null");
});

test("event with empty Records array is handled safely (records[0]?.eventSource)", async () => {
	// records[0] is undefined for an empty array; the optional chaining must
	// keep `records[0]?.eventSource` from throwing.
	const handler = middy().use(
		eventBatchParser({ value: parseJson(), disableEventSourceError: true }),
	);
	handler.handler((event) => event);

	const event = { Records: [] };
	const out = await handler(event, defaultContext);
	deepStrictEqual(out, { Records: [] });
});

// ---------- parseAvro negative path (valid type found) ----------

test("parseAvro({ internalKey }) succeeds when a valid schemaDefinition IS present (negative of !type guard)", async () => {
	const buf = buildAvroBuffer({ id: "u-pos", name: "Pos" });
	const fn = parseAvro({ internalKey: "k" });
	const out = await fn(buf, undefined, {
		internal: { k: { schemaDefinition: AVRO_USER_SCHEMA } },
	});
	deepStrictEqual(plain(out), { id: "u-pos", name: "Pos" });
});

// ---------- parseProtobuf option/internal branches ----------

test("parseProtobuf with only `root` (no messageType) falls through to internal-key path and throws", async () => {
	// Pre-bound path requires BOTH root AND messageType; with only one the
	// factory must NOT bind a parser and the runtime resolution throws.
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Buffer.from(
		Type.encode(Type.create({ id: "u-r", name: "R" })).finish(),
	);
	const fn = parseProtobuf({ root });
	let caught;
	try {
		await fn(buf, undefined, { internal: {} });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
	ok(caught.message.includes("root, messageType"));
});

test("parseProtobuf with only `messageType` (no root) throws at runtime", async () => {
	const fn = parseProtobuf({ messageType: "test.User" });
	let caught;
	try {
		await fn(Buffer.from([0x00]), undefined, { internal: {} });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
});

test("parseProtobuf({ internalKey }) is safe when request.internal is absent (optional chaining)", async () => {
	const fn = parseProtobuf({ internalKey: "k" });
	let caught;
	try {
		// No `internal` property on the request object at all.
		await fn(Buffer.from([0x00]), undefined, {});
	} catch (e) {
		caught = e;
	}
	// Must be the controlled TypeError (root/messageType missing), not a
	// TypeError from reading `.k` of undefined.
	ok(caught instanceof TypeError);
	ok(caught.message.includes("root, messageType"));
});

test("parseProtobuf throws when exactly one of root/messageType is supplied via internal (only root)", async () => {
	const root = buildProtobufRoot();
	const fn = parseProtobuf({ internalKey: "k" });
	let caught;
	try {
		await fn(Buffer.from([0x00]), undefined, { internal: { k: { root } } });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
});

test("parseProtobuf throws when exactly one of root/messageType is supplied via internal (only messageType)", async () => {
	const fn = parseProtobuf({ internalKey: "k" });
	let caught;
	try {
		await fn(Buffer.from([0x00]), undefined, {
			internal: { k: { messageType: "test.User" } },
		});
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
});
