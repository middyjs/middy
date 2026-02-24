import type { Ajv } from "ajv";
import { expect, test } from "tstyche";
import type { LocalizeFunction } from "./transpile.js";
import { transpileLocale, transpileSchema } from "./transpile.js";

test("transpileSchema returns Ajv instance", () => {
	const schema = transpileSchema({ type: "object" }, {});
	expect(schema).type.toBe<Ajv>();
});

test("transpileLocale returns LocalizeFunction", () => {
	const locale = transpileLocale("", {});
	expect(locale).type.toBe<LocalizeFunction>();
});
