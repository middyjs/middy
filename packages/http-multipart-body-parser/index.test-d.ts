import type middy from "@middy/core";
import { expectType } from "tsd";
import multipartBodyParser, { type Event } from "./index.js";

// use with default options
let middleware = multipartBodyParser();
expectType<middy.MiddlewareObj<Event>>(middleware);

// use with all options
middleware = multipartBodyParser({
	busboy: {
		headers: { "x-foo": "bar" },
		highWaterMark: 1024,
		fileHwm: 1024,
		defCharset: "utf-8",
		preservePath: false,
		limits: {
			fieldNameSize: 256,
			fieldSize: 1024 * 1024 * 10,
			fields: 100,
			fileSize: 1024 * 1024 * 10,
			files: 3,
			parts: 100,
			headerPairs: 100,
		},
	},
	charset: "utf8",
});
expectType<middy.MiddlewareObj<Event>>(middleware);
