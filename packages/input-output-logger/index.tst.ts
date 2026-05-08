import type middy from "@middy/core";
import { expect, test } from "tstyche";
import inputOutputLogger from "./index.js";

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
