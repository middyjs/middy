import type middy from "@middy/core";
import { expect, test } from "tstyche";
import eventNormalizer from "./index.js";

test("use with default options", () => {
	const middleware = eventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = eventNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
