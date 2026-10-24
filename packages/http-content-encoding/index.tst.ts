/// <reference types="node" />

import type { BrotliCompress, Deflate, Gzip, ZstdCompress } from "node:zlib";
import type middy from "@middy/core";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import httpContentEncodingMiddleware, {
	getContentEncodingStream,
} from "./index.js";

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
		contextKeyHttpContentNegotiation: "http-content-negotiation",
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("getContentEncodingStream accepts encoder options", () => {
	expect(getContentEncodingStream("gzip", { level: 1 })).type.toBe<
		BrotliCompress | Deflate | Gzip | ZstdCompress
	>();
	expect(getContentEncodingStream("br")).type.toBe<
		BrotliCompress | Deflate | Gzip | ZstdCompress
	>();
});

test("httpContentEncodingValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpContentEncodingValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(httpContentEncodingMiddleware).type.not.toBeCallableWith({
		brotli: true,
	});
});
