import type middy from "@middy/core";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import responseLogger, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = responseLogger();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = responseLogger({
		logger: (request) => {
			console.log(request.response);
		},
		omitPaths: ["response.headers.set-cookie"],
		mask: "***",
		maxBodyBytes: 1024,
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
	expect(responseLogger({ logger: false })).type.toRaiseError(2322);
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

test("Options maxBodyBytes accepts number", () => {
	expect<number>().type.toBeAssignableTo<
		NonNullable<Options["maxBodyBytes"]>
	>();
	expect<string>().type.not.toBeAssignableTo<
		NonNullable<Options["maxBodyBytes"]>
	>();
});

test("responseLoggerValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.responseLoggerValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("logger may annotate a concrete event type", () => {
	const logger = (request: middy.Request<APIGatewayProxyEvent>) => {
		console.log(request.event.path);
	};
	expect(responseLogger).type.toBeCallableWith({ logger });
});

test("rejects misspelled option", () => {
	expect(responseLogger).type.not.toBeCallableWith({ loger: () => {} });
});
