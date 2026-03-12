import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
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
