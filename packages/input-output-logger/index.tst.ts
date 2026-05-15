import type middy from "@middy/core";
import { expect, test } from "tstyche";
import inputOutputLogger, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = inputOutputLogger();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = inputOutputLogger({
		logger: (...args) => {
			console.log(...args);
		},
		executionContext: true,
		lambdaContext: true,
		omitPaths: ["a", "b", "c"],
		mask: "***",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options logger receives unknown message", () => {
	const options: Options = {
		logger: (message) => {
			expect(message).type.toBe<unknown>();
		},
	};
	expect(options).type.toBeAssignableTo<Options>();
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

test("Options executionContext and lambdaContext are boolean", () => {
	expect<boolean>().type.toBeAssignableTo<
		NonNullable<Options["executionContext"]>
	>();
	expect<boolean>().type.toBeAssignableTo<
		NonNullable<Options["lambdaContext"]>
	>();
});
