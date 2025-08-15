import type middy from "@middy/core";
import { expect } from "tstyche";
import inputOutputLogger from "./index.js";

// use with default options
let middleware = inputOutputLogger();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = inputOutputLogger({
	logger: (...args) => {
		console.log(...args);
	},
	awsContext: true,
	omitPaths: ["a", "b", "c"],
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
