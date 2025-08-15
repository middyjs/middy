import type middy from "@middy/core";
import { expect } from "tstyche";
import doNotWaitForEmptyEventLoop from "./index.js";

// use with default options
let middleware = doNotWaitForEmptyEventLoop();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = doNotWaitForEmptyEventLoop({
	runOnBefore: true,
	runOnAfter: true,
	runOnError: true,
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
