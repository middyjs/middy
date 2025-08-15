import type middy from "@middy/core";
import { expect } from "tstyche";
import httpPartialResponse from "./index.js";

// use with default options
let middleware = httpPartialResponse();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = httpPartialResponse({
	filteringKeyName: "something",
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
