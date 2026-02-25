import { deepStrictEqual, strictEqual } from "node:assert/strict";
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

const defaultContext = {
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

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 1);
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

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
	strictEqual(logger.mock.callCount(), 0);
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

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.filter(
			(r) => r.messageAttributes.resolveOrReject.stringValue === "reject",
		).map((r) => ({ itemIdentifier: r.messageId })),
	});
	strictEqual(logger.mock.callCount(), 1);
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

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 1);
});

test("Should handle event without Records array", async (t) => {
	const event = {};
	const logger = t.mock.fn();

	const handler = middy(async (e) => {
		return [{ status: "fulfilled", value: "success" }];
	}).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
	strictEqual(logger.mock.callCount(), 0);
});

test("Should handle non-function logger", async (t) => {
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

	const handler = middy(lambdaHandler).use(
		sqsPartialBatchFailure({ logger: "not-a-function" }),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
});

test("Should not override response in onError if response already exists", async (t) => {
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

	const handler = middy(async (e) => {
		throw new Error("test error");
	})
		.use(sqsPartialBatchFailure())
		.onError((request) => {
			// Set response before sqs-partial-batch-failure onError runs
			request.response = { custom: "response" };
		});

	const response = await handler(event, defaultContext);
	// The custom response should be preserved, not overridden
	deepStrictEqual(response, { custom: "response" });
});
