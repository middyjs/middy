import type middy from "@middy/core";
import { expect } from "tstyche";
import validator from "./index.js";

// use with default options
let middleware = validator();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = validator({
	eventSchema: () => {},
	contextSchema: () => {},
	responseSchema: () => {},
	defaultLanguage: "en",
	languages: {},
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
