import type middy from "@middy/core";
import { expect, test } from "tstyche";
import cloudwatchMetrics, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = cloudwatchMetrics();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = cloudwatchMetrics({
		namespace: "myApp",
		dimensions: [{ Action: "Buy" }],
		onFlushError: (error) => {
			expect(error).type.toBe<Error>();
		},
		contextKey: "metrics",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with dimensions as a single dimension set", () => {
	const middleware = cloudwatchMetrics({
		dimensions: { Action: "Buy" },
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("options declare contextKey and onFlushError", () => {
	expect<Options["contextKey"]>().type.toBe<string | undefined>();
	expect<Options["onFlushError"]>().type.toBe<
		((error: Error) => void) | undefined
	>();
});
