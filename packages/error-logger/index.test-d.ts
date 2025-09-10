import type middy from "@middy/core";
import { expect, test } from "tstyche";
import errorLogger from "./index.js";

test("use with default options", () => {
	const middleware = errorLogger();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = errorLogger({
		logger: ({ error }) => {
			console.log(error);
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
