import type middy from "@middy/core";
import type { APIGatewayEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import urlEncodePathParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = urlEncodePathParser();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event, unknown, Error>>();
});

test("Event type is union of V1 and V2", () => {
	expect<Event>().type.toBe<APIGatewayEvent | APIGatewayProxyEventV2>();
});

test("httpUrlencodePathParserValidateOptions accepts only an empty options object", () => {
	const options = {};
	expect(
		indexModule.httpUrlencodePathParserValidateOptions(options),
	).type.toBe<{}>();
	expect(
		indexModule.httpUrlencodePathParserValidateOptions,
	).type.not.toBeCallableWith({ key: "value" });
});

test("takes no options", () => {
	expect(urlEncodePathParser).type.not.toBeCallableWith({ key: "value" });
});
