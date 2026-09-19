import type { MiddyfiedHandler } from "@middy/core";
import type {
	Context,
	Handler as LambdaHandler,
	SQSBatchResponse,
	SQSEvent,
} from "aws-lambda";
import { expect, test } from "tstyche";
import ecsBatchRunner, {
	ecsBatchValidateOptions,
	type Poller,
	type RunnerHandler,
	type RunnerOptions,
} from "./index.js";

const sqsHandler: LambdaHandler<SQSEvent, SQSBatchResponse> = async () => ({
	batchItemFailures: [],
});

const sqsPoller: Poller<SQSEvent, SQSBatchResponse> = {
	source: "aws:sqs",
	async *poll() {
		yield { Records: [] } as SQSEvent;
	},
	async acknowledge() {},
};

test("RunnerOptions accepts SQS handler + poller", () => {
	const options: RunnerOptions<SQSEvent, SQSBatchResponse> = {
		handler: sqsHandler,
		poller: sqsPoller,
	};
	expect(options).type.toBeAssignableTo<
		RunnerOptions<SQSEvent, SQSBatchResponse>
	>();
});

test("RunnerOptions accepts all optional fields", () => {
	const options: RunnerOptions<SQSEvent, SQSBatchResponse> = {
		handler: sqsHandler,
		poller: sqsPoller,
		workers: 4,
		timeout: 30_000,
		gracefulShutdownMs: 60_000,
		onError: (err, event) => {
			expect(err).type.toBe<Error>();
			// undefined when the poller itself failed rather than a batch.
			expect(event).type.toBe<SQSEvent | undefined>();
		},
	};
	expect(options).type.toBeAssignableTo<
		RunnerOptions<SQSEvent, SQSBatchResponse>
	>();
});

test("RunnerOptions.handler types an inline handler from the poller", () => {
	const options: RunnerOptions<SQSEvent, SQSBatchResponse> = {
		poller: sqsPoller,
		handler: async (event, context) => {
			expect(event).type.toBe<SQSEvent>();
			expect(context).type.toBe<Context>();
			return { batchItemFailures: [] };
		},
	};
	expect(options).type.toBeAssignableTo<
		RunnerOptions<SQSEvent, SQSBatchResponse>
	>();
	// A synchronous handler is accepted too.
	expect({
		poller: sqsPoller,
		handler: (_event: SQSEvent, _context: Context) => ({
			batchItemFailures: [],
		}),
	}).type.toBeAssignableTo<RunnerOptions<SQSEvent, SQSBatchResponse>>();
});

test("RunnerOptions.handler is one call signature every handler kind satisfies", () => {
	type SqsHandler = RunnerHandler<SQSEvent, SQSBatchResponse>;
	expect<
		RunnerOptions<SQSEvent, SQSBatchResponse>["handler"]
	>().type.toBe<SqsHandler>();
	// A plain Lambda handler (whose return includes void), a middy() handler
	// and a handler that returns nothing are all assignable.
	expect<
		LambdaHandler<SQSEvent, SQSBatchResponse>
	>().type.toBeAssignableTo<SqsHandler>();
	expect<
		MiddyfiedHandler<SQSEvent, SQSBatchResponse>
	>().type.toBeAssignableTo<SqsHandler>();
	expect<
		(event: SQSEvent, context: Context) => void
	>().type.toBeAssignableTo<SqsHandler>();
	// Another result or event type is not.
	expect<
		(event: SQSEvent, context: Context) => Promise<{ nope: true }>
	>().type.not.toBeAssignableTo<SqsHandler>();
	expect<
		(event: { other: true }, context: Context) => Promise<SQSBatchResponse>
	>().type.not.toBeAssignableTo<SqsHandler>();
});

test("ecsBatchRunner returns Promise", () => {
	const result = ecsBatchRunner({ handler: sqsHandler, poller: sqsPoller });
	expect(result).type.toBe<Promise<unknown>>();
});

test("ecsBatchValidateOptions accepts a record", () => {
	expect(ecsBatchValidateOptions).type.toBeCallableWith({});
	expect(ecsBatchValidateOptions).type.toBeCallableWith();
});
