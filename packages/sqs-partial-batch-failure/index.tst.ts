import type middy from "@middy/core";
import { expect, test } from "tstyche";
import sqsPartialBatchFailure from "./index.js";

test("use with default options", () => {
	const middleware = sqsPartialBatchFailure();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = sqsPartialBatchFailure({
		logger: (...args) => {
			console.error(...args);
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
