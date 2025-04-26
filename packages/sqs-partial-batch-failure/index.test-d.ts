import type middy from "@middy/core";
import { expectType } from "tsd";
import sqsPartialBatchFailure from ".";

// use with default options
let middleware = sqsPartialBatchFailure();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = sqsPartialBatchFailure({
	logger: (...args) => {
		console.error(...args);
	},
});
expectType<middy.MiddlewareObj>(middleware);
