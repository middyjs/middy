import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
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

const thenKey = "then";

describe("@middy/sqs-partial-batch-failure", () => {
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

		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger }),
		);

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			batchItemFailures: event.Records.map((r) => ({
				itemIdentifier: r.messageId,
			})),
		});
		strictEqual(logger.mock.callCount(), 1);
	});

	// FIFO: "your function should stop processing messages after the first
	// failure and return all failed and unprocessed messages in
	// batchItemFailures".
	// docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
	const fifoRecords = (...ids) =>
		ids.map((messageId) => ({
			messageId,
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:q.fifo",
		}));

	test("FIFO: reports every record from the first failure on, including later fulfilled ones", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(async () => [
			{ status: "fulfilled" },
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
		]).use(sqsPartialBatchFailure({ logger }));

		const response = await handler(
			{ Records: fifoRecords("a", "b", "c") },
			defaultContext,
		);
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "b" }, { itemIdentifier: "c" }],
		});
		strictEqual(logger.mock.callCount(), 2);
	});

	test("FIFO: records a sequential handler never reached are reported", async () => {
		const handler = middy(async () => [
			{ status: "fulfilled" },
			{ status: "rejected", reason: new Error("boom") },
		]).use(sqsPartialBatchFailure({ logger: false }));

		const response = await handler(
			{ Records: fifoRecords("a", "b", "c", "d") },
			defaultContext,
		);
		deepStrictEqual(response, {
			batchItemFailures: [
				{ itemIdentifier: "b" },
				{ itemIdentifier: "c" },
				{ itemIdentifier: "d" },
			],
		});
	});

	test("Standard queue: a fulfilled record after a failure is not reported", async () => {
		const records = fifoRecords("a", "b");
		for (const record of records) {
			record.eventSourceARN = "arn:aws:sqs:us-east-1:123456789012:q";
		}
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
		]).use(sqsPartialBatchFailure({ logger: false }));

		const response = await handler({ Records: records }, defaultContext);
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }],
		});
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

		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger }),
		);

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

		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger }),
		);

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

	test("Should handle an empty Records array", async (t) => {
		const handler = middy(async () => []).use(
			sqsPartialBatchFailure({ logger: false }),
		);

		const response = await handler({ Records: [] }, defaultContext);
		deepStrictEqual(response, { batchItemFailures: [] });
	});

	test("Should treat records without an eventSourceARN as a standard queue", async (t) => {
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
		]).use(sqsPartialBatchFailure({ logger: false }));

		const response = await handler(
			{ Records: [{ messageId: "a" }, { messageId: "b" }] },
			defaultContext,
		);
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }],
		});
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
		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger }),
		);

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

		// Handler returns fewer entries than Records, second index is undefined
		const handler = middy(async () => [
			{ status: "fulfilled", value: "ok" },
		]).use(sqsPartialBatchFailure({ logger }));

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
		const [, { reason }] = logger.mock.calls[0].arguments;
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
		const [, { reason }] = logger.mock.calls[0].arguments;
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
			const [, { reason, record }] = logger.mock.calls[i].arguments;
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

	test("sqsPartialBatchFailureValidateOptions caps mask at 1024 printable characters", () => {
		sqsPartialBatchFailureValidateOptions({ mask: "***omitted***" });
		sqsPartialBatchFailureValidateOptions({ mask: "x".repeat(1024) });
		throws(
			() => sqsPartialBatchFailureValidateOptions({ mask: "x".repeat(1025) }),
			{
				name: "TypeError",
				message: "Option 'mask' must have length <= 1024",
				cause: { package: "@middy/sqs-partial-batch-failure" },
			},
		);
		throws(
			() => sqsPartialBatchFailureValidateOptions({ mask: "line\nbreak" }),
			{
				name: "TypeError",
				message: /^Option 'mask' must match pattern /,
				cause: { package: "@middy/sqs-partial-batch-failure" },
			},
		);
	});

	test("Should pass the request as the first logger argument", async (t) => {
		const event = createEvent.default("aws:sqs", {
			Records: [
				{
					messageAttributes: { resolveOrReject: { stringValue: "reject" } },
					body: "",
				},
			],
		});
		const logger = t.mock.fn();

		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger }),
		);

		await handler(event, defaultContext);

		strictEqual(logger.mock.callCount(), 1);
		const [request, { record }] = logger.mock.calls[0].arguments;
		strictEqual(request.event, event);
		strictEqual(request.context, defaultContext);
		strictEqual(record.messageId, event.Records[0].messageId);
	});

	test("Should redact omitPaths from the record handed to the logger", async (t) => {
		const event = createEvent.default("aws:sqs", {
			Records: [
				{
					messageAttributes: { resolveOrReject: { stringValue: "reject" } },
					body: "ssn=123-45-6789",
				},
			],
		});
		const logger = t.mock.fn();

		const handler = middy(lambdaHandler).use(
			sqsPartialBatchFailure({ logger, omitPaths: ["event.Records.[].body"] }),
		);

		const response = await handler(event, defaultContext);

		const [request, { record }] = logger.mock.calls[0].arguments;
		strictEqual(Object.hasOwn(record, "body"), false);
		strictEqual(record.messageId, event.Records[0].messageId);
		strictEqual(request.event.Records[0].body, undefined);
		strictEqual(event.Records[0].body, "ssn=123-45-6789");
		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: event.Records[0].messageId }],
		});
	});

	test("Should redact omitPaths from the reason handed to the logger", async (t) => {
		const event = createEvent.default("aws:sqs", {
			Records: [
				{
					messageAttributes: { resolveOrReject: { stringValue: "resolve" } },
					body: "",
				},
			],
		});
		const logger = t.mock.fn();
		const thrown = new Error("handler error", {
			cause: { package: "@middy/test", data: { card: "4111111111111111" } },
		});

		const handler = middy(async () => {
			throw thrown;
		}).use(
			sqsPartialBatchFailure({
				logger,
				omitPaths: ["response.[].reason.cause.data.card"],
				mask: "[redacted]",
			}),
		);

		await handler(event, defaultContext);

		const [, { reason }] = logger.mock.calls[0].arguments;
		strictEqual(reason.cause.data.card, "[redacted]");
		strictEqual(reason.message, "handler error");
		strictEqual(thrown.cause.data.card, "4111111111111111");
	});

	const standardRecords = (...ids) =>
		ids.map((messageId) => ({
			messageId,
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:q",
			body: `body of ${messageId}`,
		}));

	test("Should succeed when omitPaths removes the event and every record is fulfilled", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(async () => [
			{ status: "fulfilled" },
			{ status: "fulfilled" },
		]).use(sqsPartialBatchFailure({ logger, omitPaths: ["event"] }));

		const response = await handler(
			{ Records: standardRecords("a", "b") },
			defaultContext,
		);

		deepStrictEqual(response, { batchItemFailures: [] });
		strictEqual(logger.mock.callCount(), 0);
	});

	test("Should report only the failed record when omitPaths removes the event or its Records", async (t) => {
		for (const omitPaths of [
			["event"],
			["event.Records"],
			["event.Records.body"],
		]) {
			const logger = t.mock.fn();
			const reason = new Error("boom");
			const handler = middy(async () => [
				{ status: "fulfilled" },
				{ status: "rejected", reason },
			]).use(sqsPartialBatchFailure({ logger, omitPaths }));

			const response = await handler(
				{ Records: standardRecords("a", "b") },
				defaultContext,
			);

			deepStrictEqual(response, {
				batchItemFailures: [{ itemIdentifier: "b" }],
			});
			strictEqual(logger.mock.callCount(), 1);
			const [, failure] = logger.mock.calls[0].arguments;
			strictEqual(failure.reason, reason);
			strictEqual(failure.record, undefined);
		}
	});

	test("Should hand the logger no record when a mask replaces the event or its Records", async (t) => {
		for (const omitPaths of [
			["event"],
			["event.Records"],
			["event.Records.body"],
		]) {
			const logger = t.mock.fn();
			const handler = middy(async () => [
				{ status: "rejected", reason: new Error("boom") },
				{ status: "fulfilled" },
			]).use(sqsPartialBatchFailure({ logger, omitPaths, mask: "***" }));

			const response = await handler(
				{ Records: standardRecords("a", "b") },
				defaultContext,
			);

			deepStrictEqual(response, {
				batchItemFailures: [{ itemIdentifier: "a" }],
			});
			strictEqual(logger.mock.callCount(), 1);
			strictEqual(logger.mock.calls[0].arguments[1].record, undefined);
		}
	});

	test("Should report a throwing logger via console.error and keep the batch result", async (t) => {
		const loggerError = new Error("logger down");
		const consoleError = t.mock.method(console, "error", () => {});
		const logger = t.mock.fn(() => {
			throw loggerError;
		});
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
			{ status: "rejected", reason: new Error("boom") },
		]).use(sqsPartialBatchFailure({ logger }));

		const response = await handler(
			{ Records: standardRecords("a", "b", "c") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }, { itemIdentifier: "c" }],
		});
		strictEqual(logger.mock.callCount(), 2);
		strictEqual(consoleError.mock.callCount(), 2);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
		strictEqual(consoleError.mock.calls[1].arguments[0], loggerError);
	});

	test("Should report a rejected async logger via console.error and keep the batch result", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
		]).use(
			sqsPartialBatchFailure({
				logger: async () => {
					throw loggerError;
				},
			}),
		);

		const response = await handler(
			{ Records: standardRecords("a", "b") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }],
		});
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("Should wait for every async logger before the invocation settles", async (t) => {
		const shipped = [];
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "fulfilled" },
			{ status: "rejected", reason: new Error("boom") },
		]).use(
			sqsPartialBatchFailure({
				logger: async (_request, { record }) => {
					await setImmediate();
					shipped.push(record.messageId);
					return { chained: true };
				},
			}),
		);

		const response = await handler(
			{ Records: standardRecords("a", "b", "c") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }, { itemIdentifier: "c" }],
		});
		deepStrictEqual(shipped, ["a", "c"]);
	});

	test("Should wait for every async logger when the handler throws", async (t) => {
		const shipped = [];
		const handler = middy(async () => {
			throw new Error("boom");
		}).use(
			sqsPartialBatchFailure({
				logger: async (_request, { record }) => {
					await setImmediate();
					shipped.push(record.messageId);
				},
			}),
		);

		const response = await handler(
			{ Records: standardRecords("a", "b") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }, { itemIdentifier: "b" }],
		});
		deepStrictEqual(shipped, ["a", "b"]);
	});

	test("Should await a thenable returned by the logger", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
		]).use(
			sqsPartialBatchFailure({
				logger: () => ({
					[thenKey]: (_resolve, reject) => reject(loggerError),
				}),
			}),
		);

		const response = await handler(
			{ Records: standardRecords("a") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }],
		});
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("Should keep the after hook synchronous for a synchronous logger", (t) => {
		const consoleError = t.mock.method(console, "error", () => {});

		for (const result of [undefined, null, { chained: true }, "logged"]) {
			const logger = t.mock.fn(() => result);
			const request = {
				event: { Records: standardRecords("a", "b") },
				response: [
					{ status: "rejected", reason: new Error("boom") },
					{ status: "fulfilled" },
				],
			};

			strictEqual(sqsPartialBatchFailure({ logger }).after(request), undefined);
			deepStrictEqual(request.response, {
				batchItemFailures: [{ itemIdentifier: "a" }],
			});
			strictEqual(logger.mock.callCount(), 1);
		}
		strictEqual(consoleError.mock.callCount(), 0);
	});

	test("Should keep the after hook synchronous when no record failed", (t) => {
		const request = {
			event: { Records: standardRecords("a") },
			response: [{ status: "fulfilled" }],
		};

		strictEqual(
			sqsPartialBatchFailure({ logger: async () => {} }).after(request),
			undefined,
		);
		deepStrictEqual(request.response, { batchItemFailures: [] });
	});

	test("Should hand every failed record's logger call the same redacted request", async (t) => {
		const logger = t.mock.fn();
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
			{ status: "rejected", reason: new Error("boom") },
		]).use(
			sqsPartialBatchFailure({ logger, omitPaths: ["event.Records.[].body"] }),
		);

		const event = { Records: standardRecords("a", "b") };
		await handler(event, defaultContext);

		strictEqual(logger.mock.callCount(), 2);
		const [first] = logger.mock.calls[0].arguments;
		const [second] = logger.mock.calls[1].arguments;
		strictEqual(first, second);
		ok(first.event !== event);
		deepStrictEqual(
			logger.mock.calls.map((call) => call.arguments[1].record),
			event.Records.map(({ body, ...record }) => record),
		);
	});

	test("Should report failures silently with logger: false when omitPaths removes the event", async (t) => {
		const consoleError = t.mock.method(console, "error", () => {});
		const handler = middy(async () => [
			{ status: "fulfilled" },
			{ status: "rejected", reason: new Error("boom") },
		]).use(sqsPartialBatchFailure({ logger: false, omitPaths: ["event"] }));

		const response = await handler(
			{ Records: standardRecords("a", "b") },
			defaultContext,
		);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "b" }],
		});
		strictEqual(consoleError.mock.callCount(), 0);
	});

	test("Should keep the batch result when redacting the request throws", async (t) => {
		const redactionError = new Error("getter failed");
		const consoleError = t.mock.method(console, "error", () => {});
		const logger = t.mock.fn();
		const [record] = standardRecords("a");
		Object.defineProperty(record, "body", {
			enumerable: true,
			get() {
				throw redactionError;
			},
		});
		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
		]).use(
			sqsPartialBatchFailure({
				logger,
				omitPaths: ["event.Records.[].body.ssn"],
			}),
		);

		const response = await handler({ Records: [record] }, defaultContext);

		deepStrictEqual(response, {
			batchItemFailures: [{ itemIdentifier: "a" }],
		});
		strictEqual(logger.mock.callCount(), 0);
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], redactionError);
	});

	test("Should omit an array path whose segment holds a dot", async (t) => {
		const logger = t.mock.fn();
		const omitPaths = [
			["event", "Records", "[]", "messageAttributes", "user.email"],
		];
		sqsPartialBatchFailureValidateOptions({ omitPaths });
		const [record] = standardRecords("a");
		record.messageAttributes = {
			"user.email": { stringValue: "a@example.com" },
			tenant: { stringValue: "t1" },
		};

		const handler = middy(async () => [
			{ status: "rejected", reason: new Error("boom") },
		]).use(sqsPartialBatchFailure({ logger, omitPaths }));

		await handler({ Records: [record] }, defaultContext);

		deepStrictEqual(
			logger.mock.calls[0].arguments[1].record.messageAttributes,
			{
				tenant: { stringValue: "t1" },
			},
		);
	});

	test("sqsPartialBatchFailureValidateOptions rejects an omitPaths entry that is not a string or an array of strings", () => {
		for (const entry of [1, null, {}, ["event", 1], [["event"]], []]) {
			throws(
				() => sqsPartialBatchFailureValidateOptions({ omitPaths: [entry] }),
				{
					name: "TypeError",
					message:
						"Option 'omitPaths[0]' must match exactly one schema in oneOf",
					cause: { package: "@middy/sqs-partial-batch-failure" },
				},
			);
		}
	});

	test("sqsPartialBatchFailureValidateOptions rejects a path that could never match", () => {
		for (const path of [
			"event.Records[].body",
			"event.Records.0.body",
			"event.Records.*.body",
			["event", "Records", "__proto__"],
		]) {
			const invalidPath = { name: "TypeError", message: /^Invalid path / };
			throws(
				() => sqsPartialBatchFailureValidateOptions({ omitPaths: [path] }),
				invalidPath,
			);
			throws(() => sqsPartialBatchFailure({ omitPaths: [path] }), invalidPath);
		}
		sqsPartialBatchFailureValidateOptions({
			omitPaths: ["event.Records.[].body", ["event", "Records", "[]", "0"]],
		});
	});

	test("sqsPartialBatchFailureValidateOptions accepts omitPaths and mask", () => {
		sqsPartialBatchFailureValidateOptions({
			omitPaths: ["event.Records.[].body"],
			mask: "**",
		});
		try {
			sqsPartialBatchFailureValidateOptions({ omitPaths: "event.Records" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("omitPaths"));
		}
	});
});
