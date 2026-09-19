import type middy from "@middy/core";
import { expect, test } from "tstyche";
import errorLogger, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = errorLogger();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = errorLogger({
		logger: ({ error }) => {
			console.log(error);
		},
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
	expect<Options>().type.toBeAssignableTo<{ logger?: unknown }>();
	const noLogger: Options = {};
	expect(noLogger).type.toBeAssignableTo<Options>();
});

test("Options logger rejects false", () => {
	expect(errorLogger({ logger: false })).type.toRaiseError(2322);
	expect<false>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
	expect<boolean>().type.not.toBeAssignableTo<NonNullable<Options["logger"]>>();
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
