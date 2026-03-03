import type middy from "@middy/core";
import { expect, test } from "tstyche";
import doNotWaitForEmptyEventLoop from "./index.js";

test("use with default options", () => {
	const middleware = doNotWaitForEmptyEventLoop();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = doNotWaitForEmptyEventLoop({
		runOnBefore: true,
		runOnAfter: true,
		runOnError: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
