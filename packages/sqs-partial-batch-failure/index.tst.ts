import type middy from "@middy/core";
import { expect, test } from "tstyche";
import sqsPartialBatchFailure, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = sqsPartialBatchFailure();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = sqsPartialBatchFailure({
		logger: (...args) => {
			console.error(...args);
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options interface", () => {
	const options: Options = {};
	expect(options).type.toBeAssignableTo<Options>();

	const optionsWithLogger: Options = {
		logger: (reason, record) => {
			expect(reason).type.toBe<unknown>();
			expect(record).type.toBe<unknown>();
		},
	};
	expect(optionsWithLogger).type.toBeAssignableTo<Options>();
});
