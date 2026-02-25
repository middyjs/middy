import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpContentEncodingMiddleware from "./index.js";

test("use with default options", () => {
	const middleware = httpContentEncodingMiddleware();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpContentEncodingMiddleware({
		br: {},
		gzip: {},
		deflate: {},
		zstd: {},
		overridePreferredEncoding: ["br", "gzip", "deflate", "zstd"],
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});
