import { expectType } from "tsd";
import { transpileLocale, transpileSchema } from "./transpile.js";

const schema = transpileSchema({ type: "object" }, {});
expectType<any>(schema);

const locale = transpileLocale("", {});
expectType<any>(locale);
