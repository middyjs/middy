import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpCors, { type Options } from "./index.js";

test("use with default options", () => {
	const middleware = httpCors();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = httpCors({
		credentials: true, // Access-Control-Allow-Credentials
		disableBeforePreflightResponse: true, // answer preflight requests accordingly
		headers: "X-Custom-Header, Upgrade-Insecure-Requests", // 'Access-Control-Allow-Headers',
		methods: "POST, GET, OPTIONS", // 'Access-Control-Allow-Methods'
		origin: "foo.bar.com",
		origins: ["foo.bar.com", "foo.baz.com"],
		exposeHeaders: "Content-Length, X-Kuma-Revision", // Access-Control-Expose-Headers
		maxAge: 600, // Access-Control-Max-Age
		requestHeaders: ["X-PINGOTHER", "Content-Type"], // Access-Control-Request-Headers
		requestMethods: ["GET", "POST"], // Filter preflight by Access-Control-Request-Method
		cacheControl: "proxy-revalidate", // Cache-Control,
		getOrigin: (incomingOrigin: string, options: Options) => {
			return "foo.bar.com";
		},
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
