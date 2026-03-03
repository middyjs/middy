import createEvent from "@serverless/event-mocks";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

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
await bench
	.add(
		"S3 Event",
		async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		},
		{
			beforeEach: () => {
				defaultEvent = s3Event();
			},
		},
	)
	.add(
		"Shallow JSON (SQS) Event",
		async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		},
		{
			beforeEach: () => {
				defaultEvent = sqsEvent();
			},
		},
	)
	.add(
		"Deep JSON (S3>SNS>SQS) Event",
		async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		},
		{
			beforeEach: () => {
				defaultEvent = deepJsonEvent();
			},
		},
	)
	.add(
		"DynamoDB Event",
		async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		},
		{
			beforeEach: () => {
				defaultEvent = dynamoEvent();
			},
		},
	)
	.add(
		"Kinesis Event",
		async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		},
		{
			beforeEach: () => {
				defaultEvent = kinesisEvent();
			},
		},
	)
	.run();

console.table(bench.table());
