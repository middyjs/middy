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
		parseEncodings: true,
		availableEncodings: ["gzip", "deflate"],
		parseLanguages: true,
		availableLanguages: ["it_IT", "en_GB"],
		parseMediaTypes: true,
		availableMediaTypes: ["application/xml", "application/json"],
		failOnMismatch: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
