import type middy from "@middy/core";
import { expect } from "tstyche";
import cloudwatchMetrics, { type Context } from "./index.js";

// use with default options
let middleware = cloudwatchMetrics();
expect(middleware).type.toBe<
	middy.MiddlewareObj<unknown, any, Error, Context>
>();

// use with all options
middleware = cloudwatchMetrics({
	namespace: "myApp",
	dimensions: [{ Action: "Buy" }],
});
expect(middleware).type.toBe<
	middy.MiddlewareObj<unknown, any, Error, Context>
>();
