import type middy from "@middy/core";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import sqsPartialBatchFailure, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = sqsPartialBatchFailure();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = sqsPartialBatchFailure({
		logger: (...args) => {
			console.error(...args);
		},
		omitPaths: ["event.Records.[].body"],
		mask: "***",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options interface", () => {
	const options: Options = {};
	expect(options).type.toBeAssignableTo<Options>();

	const optionsWithLogger: Options = {
		logger: (request, failure) => {
			expect(request).type.toBe<middy.Request>();
			expect(failure).type.toBe<{ reason: unknown; record: unknown }>();
		},
	};
	expect(optionsWithLogger).type.toBeAssignableTo<Options>();
});

test("Options logger is optional", () => {
	const noLogger: Options = {};
	expect(noLogger).type.toBeAssignableTo<Options>();
});

test("Options logger accepts false to disable logging", () => {
	const disabled: Options = { logger: false };
	expect(disabled).type.toBeAssignableTo<Options>();
	expect<true>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
});

test("Options omitPaths accepts string array", () => {
	expect<string[]>().type.toBeAssignableTo<NonNullable<Options["omitPaths"]>>();
	expect<number[]>().type.not.toBeAssignableTo<
		NonNullable<Options["omitPaths"]>
	>();
});

test("Options mask accepts string", () => {
	expect<string>().type.toBeAssignableTo<NonNullable<Options["mask"]>>();
	expect<boolean>().type.not.toBeAssignableTo<NonNullable<Options["mask"]>>();
});

test("sqsPartialBatchFailureValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.sqsPartialBatchFailureValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("logger may annotate a concrete event type", () => {
	const logger = (request: middy.Request<APIGatewayProxyEvent>) => {
		console.log(request.event.path);
	};
	expect(sqsPartialBatchFailure).type.toBeCallableWith({ logger });
});

test("rejects misspelled option", () => {
	expect(sqsPartialBatchFailure).type.not.toBeCallableWith({ loger: () => {} });
});
