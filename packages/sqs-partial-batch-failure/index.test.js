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

test("Should degrade gracefully when handler returns a null response", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: { stringValue: "resolve" },
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	// Handler returns null (forgot Promise.allSettled). Must NOT raise an
	// internal TypeError that onError then re-reports as the failure reason;
	// the record is reported failed with a clean (undefined) reason.
	const handler = middy(async () => null).use(
		sqsPartialBatchFailure({ logger }),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 1);
	// The buggy path surfaces "Cannot read properties of null" as the reason.
	const [reason] = logger.mock.calls[0].arguments;
	strictEqual(reason, undefined);
});

test("Should degrade gracefully when handler returns a non-array object response", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: {
					resolveOrReject: { stringValue: "resolve" },
				},
				body: "",
			},
		],
	});
	const logger = t.mock.fn();

	const handler = middy(async () => ({ not: "an array" })).use(
		sqsPartialBatchFailure({ logger }),
	);

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 1);
	const [reason] = logger.mock.calls[0].arguments;
	strictEqual(reason, undefined);
});

test("Should log request.error as the reason for every record in onError", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: { resolveOrReject: { stringValue: "resolve" } },
				body: "",
			},
			{
				messageAttributes: { resolveOrReject: { stringValue: "resolve" } },
				body: "",
			},
		],
	});
	const logger = t.mock.fn();
	const thrown = new Error("handler error");

	const handler = middy(async () => {
		throw thrown;
	}).use(sqsPartialBatchFailure({ logger }));

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	strictEqual(logger.mock.callCount(), 2);
	// Each record's settled entry must carry reason=request.error so the logger
	// receives the thrown error (kills mutants that empty/blank the per-record
	// object, drop the map return value, or zero-out the Array.from length).
	for (let i = 0; i < event.Records.length; i++) {
		const [reason, record] = logger.mock.calls[i].arguments;
		strictEqual(reason, thrown);
		strictEqual(record.messageId, event.Records[i].messageId);
	}
});

test("Should use console.error as the default logger when none is supplied", async (t) => {
	const event = createEvent.default("aws:sqs", {
		Records: [
			{
				messageAttributes: { resolveOrReject: { stringValue: "reject" } },
				body: "",
			},
		],
	});
	// The default logger reference (console.error) is captured at module load,
	// so spy on the underlying stderr stream that console.error writes to.
	const stderrWrite = t.mock.method(process.stderr, "write", () => true);

	const handler = middy(lambdaHandler).use(sqsPartialBatchFailure());

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		batchItemFailures: event.Records.map((r) => ({
			itemIdentifier: r.messageId,
		})),
	});
	// With no logger option the default (console.error) must be used to log the
	// rejected record (kills the mutant that empties the defaults object).
	strictEqual(stderrWrite.mock.callCount(), 1);
});

test("sqsPartialBatchFailureValidateOptions accepts logger:false and rejects logger:true", () => {
	// logger:false is the documented way to disable logging and must validate.
	sqsPartialBatchFailureValidateOptions({ logger: false });
	// logger:true is not allowed by the schema (const must be false).
	try {
		sqsPartialBatchFailureValidateOptions({ logger: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/sqs-partial-batch-failure");
	}
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
