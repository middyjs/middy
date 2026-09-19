import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";
import { parseJson } from "./parseJson.js";

const pkg = "@middy/event-batch-parser";
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const kafkaHandler = middy((event) => event).use(
	middleware({ value: parseJson(), disableEventSourceError: true }),
);
const sqsHandler = middy((event) => event).use(
	middleware({ body: parseJson(), disableEventSourceError: true }),
);

const kafkaEvent = (bytes) => ({
	eventSource: "aws:kafka",
	records: { "t-0": [{ value: Buffer.from(bytes).toString("base64") }] },
});
const readKafka = (event) => event.records["t-0"][0].value;
const sqsEvent = (body) => ({ Records: [{ eventSource: "aws:sqs", body }] });
const readSqs = (event) => event.Records[0].body;

// A payload with an own `__proto__` key, or a `constructor` carrying a
// `prototype` member, at any depth must be rejected rather than parsed.
const isPollution = (text) => {
	let found = false;
	JSON.parse(text, (key, value) => {
		if (
			key === "__proto__" ||
			(key === "constructor" && value && Object.hasOwn(value, "prototype"))
		) {
			found = true;
		}
		return value;
	});
	return found;
};

// Either the record round-trips through JSON.parse, or the middleware rejects
// it with its own 422. Nothing else (a raw TypeError, a zlib error, a
// "not iterable") may escape.
const expectParsedOr422 = async (handler, event, read, text) => {
	let result;
	let error;
	try {
		result = await handler(event, defaultContext);
	} catch (e) {
		error = e;
	}
	if (error) {
		strictEqual(error.statusCode, 422);
		strictEqual(error.cause.package, pkg);
		return;
	}
	ok(!isPollution(text), "a prototype-pollution payload must be rejected");
	deepStrictEqual(read(result), JSON.parse(text));
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await kafkaHandler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== pkg) {
					throw e;
				}
			}
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});

test("fuzz Kafka base64 value w/ JSON: parsed or 422", async () => {
	await fc.assert(
		fc.asyncProperty(fc.json(), async (text) => {
			await expectParsedOr422(kafkaHandler, kafkaEvent(text), readKafka, text);
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});

test("fuzz Kafka base64 value w/ arbitrary bytes: parsed or 422", async () => {
	await fc.assert(
		fc.asyncProperty(
			// Glue framing (a leading 0x03) is pinned by the unit tests; here the
			// bytes are handed to the parser as-is.
			fc.uint8Array().filter((bytes) => bytes[0] !== 0x03),
			async (bytes) => {
				await expectParsedOr422(
					kafkaHandler,
					kafkaEvent(bytes),
					readKafka,
					Buffer.from(bytes).toString("utf-8"),
				);
			},
		),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});

test("fuzz Kafka value that is not a base64 string: 422", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.oneof(fc.object(), fc.integer(), fc.boolean(), fc.array(fc.nat())),
			async (value) => {
				const event = {
					eventSource: "aws:kafka",
					records: { "t-0": [{ value }], "t-1": "not-a-group" },
				};
				try {
					await kafkaHandler(event, defaultContext);
				} catch (e) {
					strictEqual(e.statusCode, 422);
					strictEqual(e.cause.package, pkg);
				}
			},
		),
		{
			numRuns: 2_000,
			examples: [],
		},
	);
});

test("fuzz SQS body w/ JSON: parsed or 422", async () => {
	await fc.assert(
		fc.asyncProperty(fc.json(), async (text) => {
			await expectParsedOr422(sqsHandler, sqsEvent(text), readSqs, text);
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});

test("fuzz SQS body w/ arbitrary string: parsed or 422", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (text) => {
			await expectParsedOr422(sqsHandler, sqsEvent(text), readSqs, text);
		}),
		{
			numRuns: 10_000,
			examples: [],
		},
	);
});
