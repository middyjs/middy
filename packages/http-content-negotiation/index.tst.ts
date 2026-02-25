import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpContentNegotiationMiddleware, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = httpContentNegotiationMiddleware();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = httpContentNegotiationMiddleware({
		parseCharsets: true,
		availableCharsets: ["utf-8", "iso-8859-1"],
		defaultToFirstCharset: true,
		parseEncodings: true,
		availableEncodings: ["gzip", "deflate"],
		defaultToFirstEncoding: true,
		parseLanguages: true,
		availableLanguages: ["it_IT", "en_GB"],
		defaultToFirstLanguage: true,
		parseMediaTypes: true,
		availableMediaTypes: ["application/xml", "application/json"],
		defaultToFirstMediaType: true,
		failOnMismatch: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
