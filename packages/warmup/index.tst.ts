import type middy from "@middy/core";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import warmup, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = warmup();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const options: Options = {
		isWarmingUp: (event: unknown) => typeof event === "string",
	};
	const middleware = warmup(options);
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options type", () => {
	expect<Options>().type.toBeAssignableTo<{
		isWarmingUp?: (event: unknown) => boolean;
	}>();
});

test("warmupValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.warmupValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(warmup).type.not.toBeCallableWith({ isWarmingup: () => true });
});
