import type middy from "@middy/core";
import { expectType } from "tsd";
import httpHeaderNormalizer, { type Event } from ".";

// use with default options
let middleware = httpHeaderNormalizer();
expectType<middy.MiddlewareObj<Event>>(middleware);

// use with all options
middleware = httpHeaderNormalizer({
	normalizeHeaderKey: (key: string) => key.toLowerCase(),
	canonical: false,
});
expectType<middy.MiddlewareObj<Event>>(middleware);
