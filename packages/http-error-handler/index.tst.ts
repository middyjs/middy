import type middy from "@middy/core";
import type { HttpError } from "http-errors";
import { expect, test } from "tstyche";
import httpErrorHandler from "./index.js";

test("use with default options", () => {
	const middleware = httpErrorHandler();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = httpErrorHandler({
		logger: (error: HttpError) => {
			console.error(error);
		},
		fallbackMessage: "whoopsiedoosie!",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
