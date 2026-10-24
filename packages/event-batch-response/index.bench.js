import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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
const sqsEvent100 = {
	eventSource: "aws:sqs",
	Records: Array.from({ length: 100 }, (_, i) => ({ messageId: `m-${i}` })),
};
const sqsEvent1000 = {
	eventSource: "aws:sqs",
	Records: Array.from({ length: 1000 }, (_, i) => ({ messageId: `m-${i}` })),
};

suite("event-batch-response", () => {
	bench("sqs", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(sqsEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("kinesis", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(kinesisEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("dynamodb", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(dynamoEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("kafka", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(kafkaEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("s3-batch", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(s3BatchEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("firehose", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(firehoseEvent, defaultContext);
		}
		b.end(ops);
	});
	bench("sqs N=100", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(sqsEvent100, defaultContext);
		}
		b.end(ops);
	});
	bench("sqs N=1000", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await warmHandler(sqsEvent1000, defaultContext);
		}
		b.end(ops);
	});
});
