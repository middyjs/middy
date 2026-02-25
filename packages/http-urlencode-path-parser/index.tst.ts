import type middy from "@middy/core";
import type { APIGatewayEvent } from "aws-lambda";
import { expect, test } from "tstyche";
import urlEncodePathParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = urlEncodePathParser();
	expect(middleware).type.toBe<middy.MiddlewareObj<Event, unknown, Error>>();
});

test("Event type is APIGatewayEvent", () => {
	expect<Event>().type.toBe<APIGatewayEvent>();
});
