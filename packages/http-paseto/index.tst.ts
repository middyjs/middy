import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpPaseto from "./index.js";

test("use with default options", () => {
	const middleware = httpPaseto();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("use with all options", () => {
	const middleware = httpPaseto({
		internalKey: "signingKey",
		audience: "https://api.example.com",
		issuer: "https://auth.example.com",
		clockTolerance: "5 seconds",
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

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = httpPaseto<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayEvent, unknown, Error>
	>();
	const apiGatewayV2Middleware = httpPaseto<Options, APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayProxyEventV2, unknown, Error>
	>();
});

import type { Options } from "./index.js";
