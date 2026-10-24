import { bench, suite } from "node:bench";
import createEvent from "@serverless/event-mocks";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();
const dynamoEvent = () => createEvent.default("aws:dynamo");
const kinesisEvent = () => {
	const event = createEvent.default("aws:kinesis");
	event.Records[0].kinesis.data = Buffer.from(
		JSON.stringify({ hello: "world" }),
		"utf-8",
	).toString("base64");
	return { event };
};
const s3Event = () => createEvent.default("aws:s3");
const sqsEvent = () => createEvent.default("aws:sqs");
const snsEvent = () => {
	const event = createEvent.default("aws:sns");
	event.Records[0].Sns.Message = JSON.stringify(sqsEvent());
	return event;
};

const deepJsonEvent = () => {
	const event = createEvent.default("aws:sqs");
	event.Records[0].body = JSON.stringify(snsEvent());
	return event;
};

let defaultEvent;
suite("event-normalizer", () => {
	bench("S3 Event", options, async (b) => {
		const inputs = Array.from({ length: ops }, () => s3Event());
		b.start();
		for (let i = 0; i < ops; i++) {
			defaultEvent = inputs[i];
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("Shallow JSON (SQS) Event", options, async (b) => {
		const inputs = Array.from({ length: ops }, () => sqsEvent());
		b.start();
		for (let i = 0; i < ops; i++) {
			defaultEvent = inputs[i];
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("Deep JSON (S3>SNS>SQS) Event", options, async (b) => {
		const inputs = Array.from({ length: ops }, () => deepJsonEvent());
		b.start();
		for (let i = 0; i < ops; i++) {
			defaultEvent = inputs[i];
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("DynamoDB Event", options, async (b) => {
		const inputs = Array.from({ length: ops }, () => dynamoEvent());
		b.start();
		for (let i = 0; i < ops; i++) {
			defaultEvent = inputs[i];
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("Kinesis Event", options, async (b) => {
		const inputs = Array.from({ length: ops }, () => kinesisEvent());
		b.start();
		for (let i = 0; i < ops; i++) {
			defaultEvent = inputs[i];
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
