import { Bench } from "tinybench";
import eventBatchHandler from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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

await bench
	.add("sqs", async () => {
		await handler(sqsEvent, defaultContext);
	})
	.add("kafka", async () => {
		await handler(kafkaEvent, defaultContext);
	})
	.add("s3-batch", async () => {
		await handler(s3BatchEvent, defaultContext);
	})
	.add("firehose", async () => {
		await handler(firehoseEvent, defaultContext);
	})
	.run();

console.table(bench.table());
