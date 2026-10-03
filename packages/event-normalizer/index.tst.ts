import type middy from "@middy/core";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import eventNormalizer, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = eventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const options: Options = { wrapNumbers: true };
	const middleware = eventNormalizer(options);
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options type", () => {
	expect<Options>().type.toBeAssignableTo<{ wrapNumbers?: boolean }>();
});

test("eventNormalizerValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.eventNormalizerValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(eventNormalizer).type.not.toBeCallableWith({ wrapNumber: true });
});
