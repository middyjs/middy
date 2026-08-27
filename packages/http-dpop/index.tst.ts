import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpDpop from "./index.js";

test("use with default options", () => {
	const middleware = httpDpop();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("use with all options", () => {
	const middleware = httpDpop({
		payloadKey: "paseto",
		proofKey: "dpop",
		confirmationClaim: "cnf",
		origin: "https://api.example.com",
		algorithm: ["ES256", "EdDSA"],
		maxAge: 60,
		maxProofLength: 8192,
		required: true,
		setToContext: true,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("use with a single algorithm", () => {
	const middleware = httpDpop({ algorithm: "ES256" });
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error
		>
	>();
});

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = httpDpop<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayEvent, unknown, Error>
	>();
	const apiGatewayV2Middleware = httpDpop<Options, APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<APIGatewayProxyEventV2, unknown, Error>
	>();
});

import type { Options } from "./index.js";
