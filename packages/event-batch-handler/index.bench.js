import { bench } from "node:bench";
import eventBatchHandler from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30_000,
};
const handler = eventBatchHandler(async (record) => record);

const sqsEvent = {
	eventSource: "aws:sqs",
	Records: [{ messageId: "0" }],
};
const kafkaEvent = {
	eventSource: "aws:kafka",
	records: { "topic-0": [{ topic: "t", partition: 0, offset: 0 }] },
};
const s3BatchEvent = {
	invocationSchemaVersion: "1.0",
	invocationId: "i",
	tasks: [{ taskId: "t-0" }],
};
const firehoseEvent = {
	deliveryStreamArn: "arn",
	records: [{ recordId: "r-0", data: "" }],
};

bench("event-batch-handler: sqs", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await handler(sqsEvent, defaultContext);
	}
	b.end(operations);
});

bench("event-batch-handler: kafka", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await handler(kafkaEvent, defaultContext);
	}
	b.end(operations);
});

bench("event-batch-handler: s3-batch", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await handler(s3BatchEvent, defaultContext);
	}
	b.end(operations);
});

bench("event-batch-handler: firehose", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await handler(firehoseEvent, defaultContext);
	}
	b.end(operations);
});
