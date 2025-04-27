import type middy from "@middy/core";
import { expectType } from "tsd";
import httpContentNegotiationMiddleware, { type Event } from ".";

// use with default options
let middleware = httpContentNegotiationMiddleware();
expectType<middy.MiddlewareObj<Event>>(middleware);

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
expectType<middy.MiddlewareObj<Event>>(middleware);
