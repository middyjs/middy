import { bench, suite } from "node:bench";
import eventBatchHandler from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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

suite("event-batch-handler", () => {
	bench("sqs", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await handler(sqsEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("kafka", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await handler(kafkaEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("s3-batch", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await handler(s3BatchEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("firehose", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await handler(firehoseEvent, defaultContext);
		}
		b.end(ops);
	});
});
