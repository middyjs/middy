import type middy from "@middy/core";
import { expect } from "tstyche";
import errorLogger from "./index.js";

// use with default options
let middleware = errorLogger();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = errorLogger({
	logger: ({ error }) => {
		console.log(error);
	},
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
