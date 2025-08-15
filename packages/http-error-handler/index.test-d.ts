import type middy from "@middy/core";
import type { HttpError } from "http-errors";
import { expect } from "tstyche";
import httpErrorHandler from "./index.js";

// use with default options
let middleware = httpErrorHandler();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = httpErrorHandler({
	logger: (error: HttpError) => {
		console.error(error);
	},
	fallbackMessage: "whoopsiedoosie!",
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
