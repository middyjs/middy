import type middy from "@middy/core";
import { expect, test } from "tstyche";
import validator from "./index.js";
import { transpileSchema } from "./transpile.js";

test("use with default options", () => {
	const middleware = validator();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = validator({
		eventSchema: transpileSchema({ type: "object" }),
		contextSchema: transpileSchema({ type: "object" }),
		responseSchema: transpileSchema({ type: "object" }),
		defaultLanguage: "en",
		languages: {},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with transpileSchema", () => {
	const middleware = validator({
		eventSchema: transpileSchema({ type: "object" }),
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
