import type middy from "@middy/core";
import { expect, test } from "tstyche";
import httpResponseSerializer, { type SerializerHandler } from "./index.js";

test("use with default options", () => {
	const middleware = httpResponseSerializer();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = httpResponseSerializer({
		defaultContentType: "application/json",
		serializers: [
			{
				regex: /^application\/xml$/,
				serializer: (data) => JSON.stringify(data),
			},
		],
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("SerializerHandler type is exported", () => {
	const handler: SerializerHandler = {
		regex: /^application\/json$/,
		serializer: (data) => JSON.stringify(data),
	};
	expect(handler).type.toBe<SerializerHandler>();
});
