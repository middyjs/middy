import type middy from "@middy/core";
import compile from "ajv-cmd/compile";
import { expect, test } from "tstyche";
import validator, * as indexModule from "./index.js";
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
		contextKeyHttpContentNegotiation: "http-content-negotiation",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with transpileSchema", () => {
	const middleware = validator({
		eventSchema: transpileSchema({ type: "object" }),
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with an ajv-cmd precompiled validator", () => {
	const middleware = validator({
		eventSchema: compile({ type: "object" }),
		responseSchema: compile({ type: "object" }),
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("rejects an Ajv instance where a compiled validator is expected", () => {
	expect(validator).type.not.toBeCallableWith({
		eventSchema: { compile: () => undefined },
	});
});

test("rejects an $async validator, which throws at construction", () => {
	expect(validator).type.not.toBeCallableWith({
		eventSchema: transpileSchema({ $async: true, type: "object" }),
	});
	expect(validator).type.not.toBeCallableWith({
		responseSchema: transpileSchema({ $async: true, type: "object" }),
	});
});

test("validatorValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.validatorValidateOptions(options),
	).type.toBe<indexModule.Options>();
});
