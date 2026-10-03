import type middy from "@middy/core";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import eventLogger, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = eventLogger();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = eventLogger({
		logger: (request) => {
			console.log(request.event);
		},
		omitPaths: ["event.headers.authorization"],
		mask: "***",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options logger receives middy.Request", () => {
	const options: Options = {
		logger: (request) => {
			expect(request).type.toBe<middy.Request>();
		},
	};
	expect(options).type.toBeAssignableTo<Options>();
});

test("Options logger is optional", () => {
	const noLogger: Options = {};
	expect(noLogger).type.toBeAssignableTo<Options>();
});

test("Options logger rejects false", () => {
	expect(eventLogger({ logger: false })).type.toRaiseError(2322);
	expect<false>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
	expect<boolean>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
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

test("eventLoggerValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.eventLoggerValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("logger may annotate a concrete event type", () => {
	const logger = (request: middy.Request<APIGatewayProxyEvent>) => {
		console.log(request.event.path);
	};
	expect(eventLogger).type.toBeCallableWith({ logger });
});

test("rejects misspelled option", () => {
	expect(eventLogger).type.not.toBeCallableWith({ loger: () => {} });
});
