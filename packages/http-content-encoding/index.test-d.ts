import type middy from "@middy/core";
import { expect } from "tstyche";
import httpContentEncodingMiddleware from "./index.js";

// use with default options
let middleware = httpContentEncodingMiddleware();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = httpContentEncodingMiddleware({
	br: {},
	gzip: {},
	deflate: {},
	overridePreferredEncoding: ["br", "gzip", "deflate"],
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
