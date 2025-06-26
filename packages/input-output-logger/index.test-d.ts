import type middy from "@middy/core";
import { expectType } from "tsd";
import inputOutputLogger from "./index.js";

// use with default options
let middleware = inputOutputLogger();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = inputOutputLogger({
	logger: (...args) => {
		console.log(...args);
	},
	awsContext: true,
	omitPaths: ["a", "b", "c"],
});
expectType<middy.MiddlewareObj>(middleware);
