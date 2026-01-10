import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpHeaderNormalizer, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = httpHeaderNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = httpHeaderNormalizer({
		normalizeHeaderKey: (key: string) => key.toLowerCase(),
		canonical: false,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
