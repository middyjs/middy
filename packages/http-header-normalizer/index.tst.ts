import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpHeaderNormalizer, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = httpHeaderNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = httpHeaderNormalizer({
		normalizeHeaderKey: (key: string, canonical: boolean) => key.toLowerCase(),
		canonical: false,
		defaultHeaders: { "x-custom": "value" },
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
