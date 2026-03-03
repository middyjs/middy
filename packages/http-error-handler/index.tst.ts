import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpErrorHandler from "./index.js";

test("use with default options", () => {
	const middleware = httpErrorHandler();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpErrorHandler({
		logger: (error: Error) => {
			console.error(error);
		},
		fallbackMessage: "whoopsiedoosie!",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
