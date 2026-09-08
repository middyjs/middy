import type middy from "@middy/core";
import { expect, test } from "tstyche";

import cloudformationResponse from "./index.js";

test("use with default options", () => {
	const middleware = cloudformationResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = cloudformationResponse({ sendResponse: false });
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("should not accept unknown or mistyped options", () => {
	expect(cloudformationResponse).type.not.toBeCallableWith({ routes: [] });
	expect(cloudformationResponse).type.not.toBeCallableWith({
		sendResponse: "no",
	});
});
