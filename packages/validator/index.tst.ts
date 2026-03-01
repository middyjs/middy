import type middy from "@middy/core";
import { expect, test } from "tstyche";
import validator from "./index.js";

test("use with default options", () => {
	const middleware = validator();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = validator({
		eventSchema: ((data: unknown): data is unknown =>
			true) as import("./index.js").ValidateFunction,
		contextSchema: ((data: unknown): data is unknown =>
			true) as import("./index.js").ValidateFunction,
		responseSchema: ((data: unknown): data is unknown =>
			true) as import("./index.js").ValidateFunction,
		defaultLanguage: "en",
		languages: {},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
