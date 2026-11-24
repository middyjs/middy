import type middy from "@middy/core";
import type { SQSEvent } from "aws-lambda";
import { expect, test } from "tstyche";
import eventBatchResponse, {
	eventBatchResponseValidateOptions,
	type Options,
} from "./index.js";

test("returns a middleware", () => {
	const middleware = eventBatchResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = eventBatchResponse({
		logger: (request, failure) => {
			expect(request).type.toBe<middy.Request>();
			expect(failure).type.toBe<{ reason: unknown; record: unknown }>();
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options logger is optional and accepts false to turn logging off", () => {
	expect<Record<never, never>>().type.toBeAssignableTo<Options>();
	expect<{ logger: false }>().type.toBeAssignableTo<Options>();
	expect<true>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
});

test("logger may be async", () => {
	expect(eventBatchResponse).type.toBeCallableWith({
		logger: async () => {},
	});
});

test("logger may annotate a concrete event type", () => {
	const logger = (request: middy.Request<SQSEvent>) => {
		console.log(request.event.Records.length);
	};
	expect(eventBatchResponse).type.toBeCallableWith({ logger });
});

test("eventBatchResponseValidateOptions accepts typed options and returns them", () => {
	const options = {} as Options;
	expect(eventBatchResponseValidateOptions(options)).type.toBe<Options>();
});

test("rejects misspelled option", () => {
	expect(eventBatchResponse).type.not.toBeCallableWith({ loger: () => {} });
});
