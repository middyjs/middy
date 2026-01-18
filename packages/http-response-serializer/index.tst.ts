import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpResponseSerializer from "./index.js";

test("use with default options", () => {
	const middleware = httpResponseSerializer();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = httpResponseSerializer({
		defaultContentType: "application/json",
		serializers: [
			{
				regex: /^application\/xml$/,
				serializer: (data) => data,
			},
		],
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
