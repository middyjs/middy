import type middy from "@middy/core";
import { expect } from "tstyche";
import httpContentNegotiationMiddleware, { type Event } from "./index.js";

// use with default options
let middleware = httpContentNegotiationMiddleware();
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();

// use with all options
middleware = httpContentNegotiationMiddleware({
	parseCharsets: true,
	availableCharsets: ["utf-8", "iso-8859-1"],
	parseEncodings: true,
	availableEncodings: ["gzip", "deflate"],
	parseLanguages: true,
	availableLanguages: ["it_IT", "en_GB"],
	parseMediaTypes: true,
	availableMediaTypes: ["application/xml", "application/json"],
	failOnMismatch: true,
});
expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
