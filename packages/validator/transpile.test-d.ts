import { expectType } from "tsd";
import type { transpileLocale, transpileSchema } from "./transpile.t.ds";

const schema = transpileSchema({ type: "object" }, {});
expectType<any>(schema);

const locale = transpileLocale("", {});
expectType<any>(locale);
