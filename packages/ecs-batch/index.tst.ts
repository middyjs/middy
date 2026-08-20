import type {
	Handler as LambdaHandler,
	SQSBatchResponse,
	SQSEvent,
} from "aws-lambda";
import { expect, test } from "tstyche";
import ecsBatchRunner, {
	ecsBatchValidateOptions,
	type Poller,
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
			expect(event).type.toBe<SQSEvent>();
		},
	};
	expect(options).type.toBeAssignableTo<
		RunnerOptions<SQSEvent, SQSBatchResponse>
	>();
});

test("ecsBatchRunner returns Promise", () => {
	const result = ecsBatchRunner({ handler: sqsHandler, poller: sqsPoller });
	expect(result).type.toBe<Promise<unknown>>();
});

test("ecsBatchValidateOptions accepts a record", () => {
	expect(ecsBatchValidateOptions).type.toBeCallableWith({});
	expect(ecsBatchValidateOptions).type.toBeCallableWith();
});
