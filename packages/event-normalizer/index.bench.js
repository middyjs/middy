import { bench } from "node:bench";
import createEvent from "@serverless/event-mocks";
import middy from "../core/index.js";
import middleware from "./index.js";

// The mocks are rebuilt for every measured invocation, so keep the count low
// enough that the setup between samples stays cheap.
const operations = 100;

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

// The middleware normalizes in place, so every measured invocation needs a
// fresh event; building them up front keeps that cost out of the measured
// region.
const normalizeFresh = (makeEvent) => async (b) => {
	const events = Array.from({ length: operations }, makeEvent);
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(events[i], defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench("event-normalizer: S3 Event", normalizeFresh(s3Event));
bench("event-normalizer: Shallow JSON (SQS) Event", normalizeFresh(sqsEvent));
bench(
	"event-normalizer: Deep JSON (S3>SNS>SQS) Event",
	normalizeFresh(deepJsonEvent),
);
bench("event-normalizer: DynamoDB Event", normalizeFresh(dynamoEvent));
bench("event-normalizer: Kinesis Event", normalizeFresh(kinesisEvent));
