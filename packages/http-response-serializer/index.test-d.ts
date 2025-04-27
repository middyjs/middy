import type middy from "@middy/core";
import { expectType } from "tsd";
import httpResponseSerializer from ".";

// use with default options
let middleware = httpResponseSerializer();
expectType<middy.MiddlewareObj>(middleware);

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
expectType<middy.MiddlewareObj>(middleware);
