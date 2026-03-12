import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import multipartBodyParser, { type Event } from "./index.js";

test("use with default options", () => {
	const middleware = multipartBodyParser();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			Event<APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent>,
			unknown,
			Error
		>
	>();
});

test("use with all options", () => {
	const middleware = multipartBodyParser({
		busboy: {
			headers: { "x-foo": "bar" },
			highWaterMark: 1024,
			fileHwm: 1024,
			defCharset: "utf-8",
			preservePath: false,
			limits: {
				fieldNameSize: 256,
				fieldSize: 1024 * 1024 * 10,
				fields: 100,
				fileSize: 1024 * 1024 * 10,
				files: 3,
				parts: 100,
				headerPairs: 100,
			},
		},
		charset: "utf8",
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
	const apiGatewayV1Middleware = multipartBodyParser<APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<Event<APIGatewayEvent>, unknown, Error>
	>();
	const apiGatewayV2Middleware = multipartBodyParser<APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<Event<APIGatewayProxyEventV2>, unknown, Error>
	>();
	const albMiddleware = multipartBodyParser<ALBEvent>();
	expect(albMiddleware).type.toBe<
		middy.MiddlewareObj<Event<ALBEvent>, unknown, Error>
	>();
});
