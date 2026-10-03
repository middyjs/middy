import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpHeaderNormalizer, * as indexModule from "./index.js";

test("use with default options", () => {
	const middleware = httpHeaderNormalizer();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpHeaderNormalizer({
		normalizeHeaderKey: (key: string, canonical: boolean) => key.toLowerCase(),
		canonical: false,
		defaultHeaders: { "x-custom": "value" },
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("httpHeaderNormalizerValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpHeaderNormalizerValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(httpHeaderNormalizer).type.not.toBeCallableWith({ canonicle: true });
});
