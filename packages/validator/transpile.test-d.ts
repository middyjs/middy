import { expectType } from "tsd";

const schema = transpileSchema({ type: "object" }, {});
expectType<any>(schema);

const locale = transpileLocale("", {});
expectType<any>(locale);
