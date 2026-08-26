import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpErrorHandler, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = httpErrorHandler();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpErrorHandler({
		logger: (request: middy.Request) => {
			console.error(request.error);
		},
		fallbackMessage: "whoopsiedoosie!",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options logger accepts false to disable logging", () => {
	const disabled: Options = { logger: false };
	expect(disabled).type.toBeAssignableTo<Options>();
	expect<true>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
});

test("Options omitPaths and mask", () => {
	const options: Options = {
		omitPaths: ["error.cause.data.body"],
		mask: "***",
	};
	expect(options).type.toBeAssignableTo<Options>();
	expect<number[]>().type.not.toBeAssignableTo<
		NonNullable<Options["omitPaths"]>
	>();
	expect<boolean>().type.not.toBeAssignableTo<NonNullable<Options["mask"]>>();
});
