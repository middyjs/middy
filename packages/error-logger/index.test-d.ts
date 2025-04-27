import type middy from "@middy/core";
import { expectType } from "tsd";
import errorLogger from ".";

// use with default options
let middleware = errorLogger();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = errorLogger({
	logger: ({ error }) => {
		console.log(error);
	},
});
expectType<middy.MiddlewareObj>(middleware);
