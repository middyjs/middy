import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpEventNormalizer, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = httpEventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = httpEventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
