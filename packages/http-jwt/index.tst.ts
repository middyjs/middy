import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpJwt from "./index.js";

test("use with default options", () => {
	const middleware = httpJwt();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("use with all options", () => {
	const middleware = httpJwt({
		secretKey: "my-secret",
		algorithm: "HS256",
		audience: "https://api.example.com",
		issuer: "https://auth.example.com",
		clockTolerance: 5,
		payloadKey: "auth",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("use with internalKey option", () => {
	const middleware = httpJwt({
		internalKey: "signingKey",
		algorithm: "RS256",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = httpJwt<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayEvent, unknown, Error>
	>();
	const apiGatewayV2Middleware = httpJwt<Options, APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayProxyEventV2, unknown, Error>
	>();
});

import type { Options } from "./index.js";
