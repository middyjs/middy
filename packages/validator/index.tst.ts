import type middy from "@middy/core";
import { expect, test } from "tstyche";
import validator from "./index.js";

test("use with default options", () => {
	const middleware = validator();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = validator({
		eventSchema: () => {},
		contextSchema: () => {},
		responseSchema: () => {},
		defaultLanguage: "en",
		languages: {},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
