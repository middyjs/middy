import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30_000,
};

const setupHandler = () => {
	const baseHandler = (event) => {
		let records;
		if (Array.isArray(event.Records)) records = event.Records;
		else if (Array.isArray(event.records)) records = event.records;
		else if (event.records && typeof event.records === "object")
			records = Object.values(event.records).flat();
		else if (Array.isArray(event.tasks)) records = event.tasks;
		else records = [];
		return Promise.allSettled(records.map((r) => Promise.resolve(r)));
	};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

const sqsEvent = { eventSource: "aws:sqs", Records: [{ messageId: "0" }] };
const kinesisEvent = {
	eventSource: "aws:kinesis",
	Records: [{ kinesis: { sequenceNumber: "0" } }],
};
const dynamoEvent = {
	eventSource: "aws:dynamodb",
	Records: [{ dynamodb: { SequenceNumber: "0" } }],
};
const kafkaEvent = {
	eventSource: "aws:kafka",
	records: { "topic-0": [{ topic: "topic", partition: 0, offset: 0 }] },
};
const s3BatchEvent = {
	invocationSchemaVersion: "1.0",
	invocationId: "i",
	job: { id: "j" },
	tasks: [{ taskId: "t-0", s3Key: "k" }],
};
const firehoseEvent = {
	deliveryStreamArn: "arn",
	invocationId: "i",
	records: [{ recordId: "r-0", data: "" }],
};

await bench
	.add("sqs", async () => {
		await warmHandler(sqsEvent, defaultContext);
	})
	.add("kinesis", async () => {
		await warmHandler(kinesisEvent, defaultContext);
	})
	.add("dynamodb", async () => {
		await warmHandler(dynamoEvent, defaultContext);
	})
	.add("kafka", async () => {
		await warmHandler(kafkaEvent, defaultContext);
	})
	.add("s3-batch", async () => {
		await warmHandler(s3BatchEvent, defaultContext);
	})
	.add("firehose", async () => {
		await warmHandler(firehoseEvent, defaultContext);
	})
	.run();

console.table(bench.table());
