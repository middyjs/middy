import type middy from "@middy/core";
import { expect, test } from "tstyche";
import cloudwatchMetrics from "./index.js";

test("use with default options", () => {
	const middleware = cloudwatchMetrics();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = cloudwatchMetrics({
		namespace: "myApp",
		dimensions: [{ Action: "Buy" }],
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with dimensions as a single dimension set", () => {
	const middleware = cloudwatchMetrics({
		dimensions: { Action: "Buy" },
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
