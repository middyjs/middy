import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import createEvent from "@serverless/event-mocks";

import middy from "../core/index.js";
import sqsPartialBatchFailure, {
	sqsPartialBatchFailureValidateOptions,
} from "./index.js";

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

test("Should use default logger without error", async (t) => {
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
	strictEqual(logger.mock.callCount(), 1);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
});

test("Should handle logger set to false", async (t) => {
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
		sqsPartialBatchFailure({ logger: false }),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
});

test("Should handle onError with undefined Records", async (t) => {
	const event = {};
	const logger = t.mock.fn();

	const handler = middy(async () => {
		throw new Error("handler error");
	}).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { batchItemFailures: [] });
	strictEqual(logger.mock.callCount(), 0);
});

test("Should reject all records in onError with multiple records", async (t) => {
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

	const handler = middy(async () => {
		throw new Error("handler error");
	}).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 2);
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

test("Should treat missing response entries as rejected", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: { stringValue: "resolve" },
				},
				body: "",
			},
			{
				messageAttributes: {
					resolveOrReject: { stringValue: "resolve" },
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	// Handler returns fewer entries than Records — second index is undefined
	const handler = middy(async () => [{ status: "fulfilled", value: "ok" }]).use(
		sqsPartialBatchFailure({ logger }),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: [{ itemIdentifier: event.Records[1].messageId }],
	});
	strictEqual(logger.mock.callCount(), 1);
});

test("sqsPartialBatchFailureValidateOptions accepts valid options and rejects typos", () => {
	sqsPartialBatchFailureValidateOptions({ logger: () => {} });
	sqsPartialBatchFailureValidateOptions({});
	try {
		sqsPartialBatchFailureValidateOptions({ loger: () => {} });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/sqs-partial-batch-failure");
	}
});

test("sqsPartialBatchFailureValidateOptions rejects wrong type", () => {
	try {
		sqsPartialBatchFailureValidateOptions({ logger: "not-a-fn" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("logger"));
	}
});
