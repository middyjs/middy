import type middy from "@middy/core";
import { expect, test } from "tstyche";
import multipartBodyParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = multipartBodyParser();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const middleware = multipartBodyParser({
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
	expect(middleware).type.toBe<middy.MiddlewareObj<Event>>();
});
