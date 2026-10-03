import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { parseJson } from "./parseJson.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

// Kafka delivers base64 record values; SQS delivers the body as plain utf8 text.
const kafkaHandler = middy(() => undefined).use(
	middleware({ value: parseJson() }),
);
const sqsHandler = middy(() => undefined).use(
	middleware({ body: parseJson() }),
);

const makeKafkaEvent = (n) => ({
	eventSource: "aws:kafka",
	records: {
		"my-topic-0": Array.from({ length: n }, (_, i) => ({
			topic: "my-topic",
			partition: 0,
			offset: i,
			value: Buffer.from(`{"hello":"world","i":${i}}`).toString("base64"),
		})),
	},
});
const makeSqsEvent = (n) => ({
	eventSource: "aws:sqs",
	Records: Array.from({ length: n }, (_, i) => ({
		messageId: String(i),
		body: `{"hello":"world","i":${i}}`,
	})),
});

// The middleware parses record values in place, so each measured iteration needs
// a fresh event; build them before b.start() (not counted toward the timing) rather
// than reusing one event, which would parse once and then hit the error path.
let event;
const reuse = (handler) => async () => {
	await handler(event, defaultContext);
};

suite("event-batch-parser", () => {
	bench("kafka json N=1", options, async (b) => {
		const run = reuse(kafkaHandler);
		const inputs = Array.from({ length: ops }, () => makeKafkaEvent(1));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
	bench("kafka json N=10", options, async (b) => {
		const run = reuse(kafkaHandler);
		const inputs = Array.from({ length: ops }, () => makeKafkaEvent(10));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
	bench("kafka json N=100", options, async (b) => {
		const run = reuse(kafkaHandler);
		const inputs = Array.from({ length: ops }, () => makeKafkaEvent(100));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
	bench("sqs json N=1", options, async (b) => {
		const run = reuse(sqsHandler);
		const inputs = Array.from({ length: ops }, () => makeSqsEvent(1));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
	bench("sqs json N=10", options, async (b) => {
		const run = reuse(sqsHandler);
		const inputs = Array.from({ length: ops }, () => makeSqsEvent(10));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
	bench("sqs json N=100", options, async (b) => {
		const run = reuse(sqsHandler);
		const inputs = Array.from({ length: ops }, () => makeSqsEvent(100));
		b.start();
		for (let i = 0; i < ops; i++) {
			event = inputs[i];
			await run();
		}
		b.end(ops);
	});
});
