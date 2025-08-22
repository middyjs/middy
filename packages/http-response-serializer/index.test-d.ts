import type middy from "@middy/core";
import { expect } from "tstyche";
import httpResponseSerializer from "./index.js";

// use with default options
let middleware = httpResponseSerializer();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = httpResponseSerializer({
	defaultContentType: "application/json",
	serializers: [
		{
			regex: /^application\/xml$/,
			serializer: (data) => data,
		},
	],
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
