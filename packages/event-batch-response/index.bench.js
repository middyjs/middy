import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;
// Big batches do proportionally more work per invocation.
const batchOperations = 100;

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

const respond = (event, count) => async (b) => {
	b.start();
	for (let i = 0; i < count; i++) {
		await warmHandler(event, defaultContext);
	}
	b.end(count);
};

bench("event-batch-response: sqs", respond(sqsEvent, operations));
bench("event-batch-response: kinesis", respond(kinesisEvent, operations));
bench("event-batch-response: dynamodb", respond(dynamoEvent, operations));
bench("event-batch-response: kafka", respond(kafkaEvent, operations));
bench("event-batch-response: s3-batch", respond(s3BatchEvent, operations));
bench("event-batch-response: firehose", respond(firehoseEvent, operations));
bench("event-batch-response: sqs N=100", respond(sqsEvent100, batchOperations));
bench(
	"event-batch-response: sqs N=1000",
	respond(sqsEvent1000, batchOperations),
);
