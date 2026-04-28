import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import avro from "avro-js";
import { mockClient } from "aws-sdk-client-mock";
import protobuf from "protobufjs";
import middy from "../core/index.js";
import { clearCache } from "../util/index.js";
import eventBatchParser, {
	eventBatchParserValidateOptions,
	parseAvro,
	parseJson,
	parseProtobuf,
} from "./index.js";

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

test("parseJson on Firehose data", async () => {
	const handler = middy().use(eventBatchParser({ data: parseJson() }));
	handler.handler((event) => event);

	const event = {
		deliveryStreamArn: "arn:...",
		records: [{ eventSource: "aws:lambda:events", data: b64('{"f":1}') }],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records[0].data, { f: 1 });
});

test("parseJson on SQS body", async () => {
	const handler = middy().use(eventBatchParser({ body: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [{ eventSource: "aws:sqs", body: b64('{"s":1}') }],
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.Records[0].body, { s: 1 });
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

// ---------- internalKey fallback ----------

test('parseAvro() falls back to request.internal["glue-schema-registry"].schema', async () => {
	const buf = buildAvroBuffer({ id: "u-4", name: "Dave" });
	const stubRegistry = () => ({
		before: (request) => {
			request.internal["glue-schema-registry"] = {
				schemas: new Map(),
				schema: AVRO_USER_SCHEMA,
			};
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseAvro() }));
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

test("parseAvro({ internalKey: 'custom' }) reads from custom slot", async () => {
	const buf = buildAvroBuffer({ id: "u-5", name: "Eve" });
	const stubRegistry = () => ({
		before: (request) => {
			request.internal.custom = {
				schemas: new Map(),
				schema: AVRO_USER_SCHEMA,
			};
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseAvro({ internalKey: "custom" }) }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: buf.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(plain(out.records["t-0"][0].value), {
		id: "u-5",
		name: "Eve",
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

test("Glue framing: parses _schemaVersionId and _payload", async () => {
	const inner = buildAvroBuffer({ id: "u-6", name: "Faye" });
	const uuid = "12345678-1234-1234-1234-1234567890ab";
	const framed = glueFramedBuffer(uuid, inner);

	const stubRegistry = () => ({
		before: (request) => {
			const schemas = new Map();
			schemas.set(uuid, {
				schemaDefinition: AVRO_USER_SCHEMA,
				dataFormat: "AVRO",
			});
			request.internal["glue-schema-registry"] = { schemas, schema: undefined };
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseAvro() }));
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

	const stubRegistry = () => ({
		before: (request) => {
			const schemas = new Map();
			schemas.set(uuid, {
				schemaDefinition: AVRO_USER_SCHEMA,
				dataFormat: "AVRO",
			});
			request.internal["glue-schema-registry"] = { schemas, schema: undefined };
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseAvro() }));
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

test("Mismatched config: key for Kinesis throws TypeError", async () => {
	const handler = middy().use(eventBatchParser({ key: parseJson() }));
	handler.handler((event) => event);

	const event = {
		Records: [
			{ eventSource: "aws:kinesis", kinesis: { data: b64('{"x":1}') } },
		],
	};

	await rejects(() => handler(event, defaultContext), TypeError);
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

test("parseAvro() throws TypeError when no schema and no internal slot", async () => {
	const buf = buildAvroBuffer({ id: "u-x", name: "X" });
	const handler = middy().use(eventBatchParser({ value: parseAvro() }));
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
	ok(caught.cause.message.includes("glue-schema-registry"));
});

test("parseProtobuf() falls back to request.internal slot", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-9", name: "Ivy" })).finish();

	const stubRegistry = () => ({
		before: (request) => {
			request.internal["glue-schema-registry"] = {
				schemas: new Map(),
				root,
				messageType: "test.User",
			};
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseProtobuf() }));
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

test("parseProtobuf() resolves messageType from per-uuid schemas Map", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const inner = Type.encode(Type.create({ id: "u-10", name: "Jay" })).finish();
	const uuid = "11111111-2222-3333-4444-555555555555";
	const framed = glueFramedBuffer(uuid, Buffer.from(inner));

	const stubRegistry = () => ({
		before: (request) => {
			const schemas = new Map();
			schemas.set(uuid, { messageType: "test.User", dataFormat: "PROTOBUF" });
			request.internal["glue-schema-registry"] = { schemas, root };
		},
	});

	const handler = middy()
		.use(stubRegistry())
		.use(eventBatchParser({ value: parseProtobuf() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: { "t-0": [{ value: framed.toString("base64") }] },
	};

	const out = await handler(event, defaultContext);
	deepStrictEqual(out.records["t-0"][0].value, { id: "u-10", name: "Jay" });
});

test("parseProtobuf() throws TypeError when neither factory nor slot supplies root+messageType", async () => {
	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const buf = Type.encode(Type.create({ id: "u-11", name: "Kim" })).finish();

	const handler = middy().use(eventBatchParser({ value: parseProtobuf() }));
	handler.handler((event) => event);

	const event = {
		eventSource: "aws:kafka",
		records: {
			"t-0": [{ value: Buffer.from(buf).toString("base64") }],
		},
	};

	let caught;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		caught = e;
	}
	ok(caught);
	strictEqual(caught.statusCode, 422);
	ok(caught.cause.message.includes("glue-schema-registry"));
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

test("parseAvro/parseProtobuf accept buffer-only call (no record arg)", async () => {
	const avroBuf = buildAvroBuffer({ id: "z", name: "Z" });
	const fnAvroStatic = parseAvro({ schema: AVRO_USER_SCHEMA });
	deepStrictEqual(plain(await fnAvroStatic(avroBuf)), { id: "z", name: "Z" });

	const fnAvroDyn = parseAvro();
	const dynRequest = {
		internal: {
			"glue-schema-registry": {
				schemas: new Map(),
				schema: AVRO_USER_SCHEMA,
			},
		},
	};
	deepStrictEqual(plain(await fnAvroDyn(avroBuf, undefined, dynRequest)), {
		id: "z",
		name: "Z",
	});

	const root = buildProtobufRoot();
	const Type = root.lookupType("test.User");
	const protoBuf = Buffer.from(
		Type.encode(Type.create({ id: "p", name: "P" })).finish(),
	);
	const fnProtoStatic = parseProtobuf({ root, messageType: "test.User" });
	deepStrictEqual(fnProtoStatic(protoBuf), { id: "p", name: "P" });

	const fnProtoDyn = parseProtobuf();
	const protoDynRequest = {
		internal: {
			"glue-schema-registry": {
				schemas: new Map(),
				root,
				messageType: "test.User",
			},
		},
	};
	deepStrictEqual(fnProtoDyn(protoBuf, undefined, protoDynRequest), {
		id: "p",
		name: "P",
	});

	let caught;
	try {
		parseProtobuf()(protoBuf, undefined, { internal: {} });
	} catch (e) {
		caught = e;
	}
	ok(caught instanceof TypeError);
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

test("glueSchemaRegistry option resolves UUIDs via @middy/glue-schema-registry", async () => {
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

	const handler = middy().use(
		eventBatchParser({
			value: parseAvro(),
			glueSchemaRegistry: {
				AwsClient: GlueClient,
				disablePrefetch: true,
				cacheExpiry: 0,
			},
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
