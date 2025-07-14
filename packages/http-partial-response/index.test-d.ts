import type middy from "@middy/core";
import { expectType } from "tsd";
import httpPartialResponse from "./index.js";

// use with default options
let middleware = httpPartialResponse();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = httpPartialResponse({
	filteringKeyName: "something",
});
expectType<middy.MiddlewareObj>(middleware);
