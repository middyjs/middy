import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { parseJson } from "./parseJson.js";

const operations = 1_000;
// 100-record events allocate 100x the objects, so fewer of them per sample.
const batchOperations = 100;

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

// The middleware parses record values in place, so every measured invocation
// needs a fresh event; reusing one would parse once and then hit the error
// path. Building them up front keeps that cost out of the measured region.
const parseFresh = (handler, makeEvent, count) => async (b) => {
	const events = Array.from({ length: count }, makeEvent);
	b.start();
	for (let i = 0; i < count; i++) {
		await handler(events[i], defaultContext);
	}
	b.end(count);
};

bench(
	"event-batch-parser: kafka json N=1",
	parseFresh(kafkaHandler, () => makeKafkaEvent(1), operations),
);

bench(
	"event-batch-parser: kafka json N=10",
	parseFresh(kafkaHandler, () => makeKafkaEvent(10), operations),
);

bench(
	"event-batch-parser: kafka json N=100",
	parseFresh(kafkaHandler, () => makeKafkaEvent(100), batchOperations),
);

bench(
	"event-batch-parser: sqs json N=1",
	parseFresh(sqsHandler, () => makeSqsEvent(1), operations),
);

bench(
	"event-batch-parser: sqs json N=10",
	parseFresh(sqsHandler, () => makeSqsEvent(10), operations),
);

bench(
	"event-batch-parser: sqs json N=100",
	parseFresh(sqsHandler, () => makeSqsEvent(100), batchOperations),
);
