import type middy from "@middy/core";
import { expectType } from "tsd";
import doNotWaitForEmptyEventLoop from ".";

// use with default options
let middleware = doNotWaitForEmptyEventLoop();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = doNotWaitForEmptyEventLoop({
	runOnBefore: true,
	runOnAfter: true,
	runOnError: true,
});
expectType<middy.MiddlewareObj>(middleware);
