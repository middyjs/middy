import type { AsyncValidateFunction, ValidateFunction } from "ajv";
import { expect, test } from "tstyche";
import type { LocalizeFunction } from "./transpile.js";
import { transpileFTL, transpileSchema } from "./transpile.js";

test("transpileSchema returns a compiled validate function", () => {
	const validate = transpileSchema({ type: "object" }, {});
	expect(validate).type.toBe<ValidateFunction | AsyncValidateFunction>();
});

test("transpileSchema accepts ajv options including keywords", () => {
	const validate = transpileSchema(
		{ type: "object" },
		{ keywords: [{ keyword: "myKw" }] },
	);
	expect(validate).type.toBe<ValidateFunction | AsyncValidateFunction>();
});

test("transpileFTL returns the transpiled module source", () => {
	const source = transpileFTL("", { locale: "en" });
	expect(source).type.toBe<string>();
});

test("LocalizeFunction is the localizer shape passed to languages", () => {
	const localize: LocalizeFunction = (errors) => {
		expect(errors).type.toBeAssignableTo<unknown[] | null | undefined>();
	};
	expect(localize).type.toBe<LocalizeFunction>();
});
