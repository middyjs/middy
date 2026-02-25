import type middy from "@middy/core";
import { expect, test } from "tstyche";
import urlEncodeBodyParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = urlEncodeBodyParser();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = urlEncodeBodyParser({
		disableContentTypeCheck: true,
		disableContentTypeError: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
