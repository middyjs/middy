import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import wsJsonBodyParser, { type Event, type Options } from "./index.js";

test("use with default options", () => {
	expect(wsJsonBodyParser()).type.toBe<
		middy.MiddlewareObj<Event, unknown, Error>
	>();
});

test("use with all options", () => {
	const options: Options = {
		reviver: (key: string, value: unknown) => Boolean(value),
	};
	expect(wsJsonBodyParser(options)).type.toBe<
		middy.MiddlewareObj<Event, unknown, Error>
	>();
});

test("Event type extends websocket event", () => {
	expect<Event>().type.toBeAssignableTo<
		Omit<APIGatewayProxyWebsocketEventV2, "body">
	>();
});

test("Options type", () => {
	expect<Options>().type.toBeAssignableTo<{
		reviver?: (key: string, value: unknown) => unknown;
	}>();
});

test("wsJsonBodyParserValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.wsJsonBodyParserValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(wsJsonBodyParser).type.not.toBeCallableWith({ revivr: () => null });
});
