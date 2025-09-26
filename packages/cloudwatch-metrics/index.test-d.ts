import type middy from "@middy/core";
import { expect, test } from "tstyche";
import cloudwatchMetrics, { type Context } from "./index.js";

test("use with default options", () => {
	const middleware = cloudwatchMetrics();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context>
	>();
});

test("use with all options", () => {
	const middleware = cloudwatchMetrics({
		namespace: "myApp",
		dimensions: [{ Action: "Buy" }],
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context>
	>();
});
