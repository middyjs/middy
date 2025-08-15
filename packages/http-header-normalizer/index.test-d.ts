import type middy from "@middy/core";
import { expect } from "tstyche";
import httpHeaderNormalizer, { type Event } from "./index.js";

// use with default options
let middleware = httpHeaderNormalizer();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();

// use with all options
middleware = httpHeaderNormalizer({
	normalizeHeaderKey: (key: string) => key.toLowerCase(),
	canonical: false,
});
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
