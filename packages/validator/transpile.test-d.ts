import type { Ajv } from "ajv";
import { expect } from "tstyche";
import { transpileLocale, transpileSchema } from "./transpile.js";

const schema = transpileSchema({ type: "object" }, {});
expect(schema).type.toBe<Ajv>();

const locale = transpileLocale("", {});
expect(locale).type.toBe<Function>();
