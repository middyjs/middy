import type middy from "@middy/core";
import { expect, test } from "tstyche";
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
