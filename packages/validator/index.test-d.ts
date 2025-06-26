import type middy from "@middy/core";
import { expectType } from "tsd";
import validator from "./index.js";

// use with default options
let middleware = validator();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = validator({
	eventSchema: () => {},
	contextSchema: () => {},
	responseSchema: () => {},
	defaultLanguage: "en",
	languages: {},
});
expectType<middy.MiddlewareObj>(middleware);
