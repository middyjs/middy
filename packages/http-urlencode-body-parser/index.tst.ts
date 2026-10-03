import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import urlEncodeBodyParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = urlEncodeBodyParser();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			Event<APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent>,
			unknown,
			Error
		>
	>();
});

test("use with all options", () => {
	const middleware = urlEncodeBodyParser({
		disableContentTypeCheck: true,
		disableContentTypeError: true,
		maxKeys: 5000,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			Event<APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent>,
			unknown,
			Error
		>
	>();
});

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = urlEncodeBodyParser<APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<Event<APIGatewayEvent>, unknown, Error>
	>();
	const apiGatewayV2Middleware = urlEncodeBodyParser<APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<Event<APIGatewayProxyEventV2>, unknown, Error>
	>();
	const albMiddleware = urlEncodeBodyParser<ALBEvent>();
	expect(albMiddleware).type.toBe<
		middy.MiddlewareObj<Event<ALBEvent>, unknown, Error>
	>();
});

test("httpUrlencodeBodyParserValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpUrlencodeBodyParserValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("parsed body is an object, not the raw string", () => {
	expect<{ a: string }>().type.toBeAssignableTo<
		Event<APIGatewayEvent>["body"]
	>();
	expect<{ a: string }>().type.toBeAssignableTo<Event["body"]>();
});

test("rejects misspelled option", () => {
	expect(urlEncodeBodyParser).type.not.toBeCallableWith({ maxKey: 10 });
});
