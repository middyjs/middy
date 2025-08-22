import type middy from "@middy/core";
import { expect } from "tstyche";
import sqsPartialBatchFailure from "./index.js";

// use with default options
let middleware = sqsPartialBatchFailure();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = sqsPartialBatchFailure({
	logger: (...args) => {
		console.error(...args);
	},
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
