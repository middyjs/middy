import type middy from "@middy/core";
import { expectType } from "tsd";
import httpContentEncodingMiddleware from "./index.js";

// use with default options
let middleware = httpContentEncodingMiddleware();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = httpContentEncodingMiddleware({
	br: {},
	gzip: {},
	deflate: {},
	overridePreferredEncoding: ["br", "gzip", "deflate"],
});
expectType<middy.MiddlewareObj>(middleware);
