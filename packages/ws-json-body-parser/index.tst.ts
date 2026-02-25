import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { expect, test } from "tstyche";
import wsJsonBodyParser, { type Event, type Options } from "./index.js";

test("use with default options", () => {
	expect(wsJsonBodyParser()).type.toBe<middy.MiddlewareObj<Event>>();
});

test("use with all options", () => {
	const options: Options = {
		reviver: (key: string, value: any) => Boolean(value),
	};
	expect(wsJsonBodyParser(options)).type.toBe<middy.MiddlewareObj<Event>>();
});

test("Event type extends websocket event", () => {
	expect<Event>().type.toBeAssignableTo<
		Omit<APIGatewayProxyWebsocketEventV2, "body">
	>();
});

test("Options type", () => {
	expect<Options>().type.toBeAssignableTo<{
		reviver?: (key: string, value: any) => any;
	}>();
});
