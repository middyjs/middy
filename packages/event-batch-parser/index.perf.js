import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { parseJson } from "./parseJson.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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
// a fresh event; rebuild it in beforeEach (not counted toward the timing) rather
// than reusing one event, which would parse once and then hit the error path.
let event;
const reuse = (handler) => async () => {
	await handler(event, defaultContext);
};

await bench
	.add("kafka json N=1", reuse(kafkaHandler), {
		beforeEach: () => {
			event = makeKafkaEvent(1);
		},
	})
	.add("kafka json N=10", reuse(kafkaHandler), {
		beforeEach: () => {
			event = makeKafkaEvent(10);
		},
	})
	.add("kafka json N=100", reuse(kafkaHandler), {
		beforeEach: () => {
			event = makeKafkaEvent(100);
		},
	})
	.add("sqs json N=1", reuse(sqsHandler), {
		beforeEach: () => {
			event = makeSqsEvent(1);
		},
	})
	.add("sqs json N=10", reuse(sqsHandler), {
		beforeEach: () => {
			event = makeSqsEvent(10);
		},
	})
	.add("sqs json N=100", reuse(sqsHandler), {
		beforeEach: () => {
			event = makeSqsEvent(100);
		},
	})
	.run();

console.table(bench.table());
