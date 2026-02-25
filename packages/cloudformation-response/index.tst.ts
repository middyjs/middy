import type middy from "@middy/core";
import { expect, test } from "tstyche";

import cloudformationResponse from "./index.js";

test("use with default options", () => {
	const middleware = cloudformationResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("should not accept options", () => {
	expect(cloudformationResponse).type.not.toBeCallableWith({});
});
