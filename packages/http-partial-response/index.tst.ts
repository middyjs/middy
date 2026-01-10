import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpPartialResponse from "./index.js";

test("use with default options", () => {
	const middleware = httpPartialResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
test("use with all options", () => {
	const middleware = httpPartialResponse({
		filteringKeyName: "something",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
