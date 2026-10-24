import type middy from "@middy/core";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import httpPartialResponse, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = httpPartialResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const options: Options = { filteringKeyName: "fields" };
	const middleware = httpPartialResponse(options);
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("Options type", () => {
	expect<Options>().type.toBeAssignableTo<{ filteringKeyName?: string }>();
});

test("httpPartialResponseValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpPartialResponseValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(httpPartialResponse).type.not.toBeCallableWith({
		filteringKey: "fields",
	});
});
