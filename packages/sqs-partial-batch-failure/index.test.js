import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import createEvent from "@serverless/event-mocks";

import middy from "../core/index.js";
import sqsPartialBatchFailure from "./index.js";

const lambdaHandler = async (e) => {
	const processedRecords = e.Records.map(async (r) => {
		if (r.messageAttributes.resolveOrReject.stringValue === "resolve") {
			return r.messageId;
		}
		throw new Error("record");
	});
	return Promise.allSettled(processedRecords);
};

// const event = {}
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("Should return when there are only failed messages", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: {
						stringValue: "reject",
					},
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	const handler = middy(lambdaHandler).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, context);

	deepEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	equal(logger.mock.callCount(), 1);
});

test("Should resolve when there are no failed messages", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: {
						stringValue: "resolve",
					},
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	const handler = middy(lambdaHandler).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, context);
	deepEqual(response, { batchItemFailures: [] });
	equal(logger.mock.callCount(), 0);
});

test("Should return only the rejected messageIds", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: {
						stringValue: "reject",
					},
				},
				body: "",
			},
			{
				messageAttributes: {
					resolveOrReject: {
						stringValue: "resolve",
					},
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	const handler = middy(lambdaHandler).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, context);
	deepEqual(response, {
		batchItemFailures: event.Records.filter(
			(r) => r.messageAttributes.resolveOrReject.stringValue === "reject",
		).map((r) => ({ itemIdentifier: r.messageId })),
	});
	equal(logger.mock.callCount(), 1);
});

test("Should reject all messageIds when error is thrown", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: {
						stringValue: "resolve",
					},
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	const handler = middy(lambdaHandler)
		.before(() => {
			throw new Error("before", {
				cause: {
					package: "@middy/core",
				},
			});
		})
		.use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, context);
	deepEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	equal(logger.mock.callCount(), 1);
});
