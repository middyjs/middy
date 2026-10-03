import middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import httpPaseto, {
	type Context,
	type Internal,
	type Options,
	type PasetoPayload,
} from "./index.js";

test("use with default options", () => {
	const middleware = httpPaseto();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error,
			Context<Options>,
			Internal
		>
	>();
});

test("use with all options", () => {
	const middleware = httpPaseto({
		internalKey: "signingKey",
		audience: "https://api.example.com",
		issuer: "https://auth.example.com",
		clockTolerance: 5,
		maxTokenAge: 3600,
		expectedClaims: { typ: "access" },
		payloadKey: "auth",
		tokenKey: "authToken",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent,
			unknown,
			Error,
			Context<Options>,
			Internal<"auth", "authToken">
		>
	>();
});

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = httpPaseto<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent,
			unknown,
			Error,
			Context<Options>,
			Internal
		>
	>();
	const apiGatewayV2Middleware = httpPaseto<Options, APIGatewayProxyEventV2>();
	expect(apiGatewayV2Middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayProxyEventV2,
			unknown,
			Error,
			Context<Options>,
			Internal
		>
	>();
});

test("options declare maxTokenAge", () => {
	expect<Options["maxTokenAge"]>().type.toBe<number | undefined>();
});

test("httpPasetoValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpPasetoValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("internal carries the payload and token under their keys", () => {
	middy()
		.use(httpPaseto({ internalKey: "signingKey" }))
		.before((request) => {
			expect(request.internal.paseto).type.toBe<PasetoPayload>();
			expect(request.internal.pasetoToken).type.toBe<string>();
		});
	middy()
		.use(httpPaseto({ internalKey: "signingKey", payloadKey: "auth" }))
		.before((request) => {
			expect(request.internal.auth).type.toBe<PasetoPayload>();
			expect(request.internal.authToken).type.toBe<string>();
		});
	middy()
		.use(
			httpPaseto({
				internalKey: "signingKey",
				payloadKey: "auth",
				tokenKey: "raw",
			}),
		)
		.before((request) => {
			expect(request.internal.raw).type.toBe<string>();
		});
});

test("setToContext publishes the payload on middyContext", () => {
	middy()
		.use(
			httpPaseto({
				internalKey: "signingKey",
				payloadKey: "auth",
				setToContext: true,
			}),
		)
		.before((request) => {
			expect(request.context.middyContext.auth).type.toBe<PasetoPayload>();
		});
});

test("rejects misspelled option", () => {
	expect(httpPaseto).type.not.toBeCallableWith({
		internalKey: "signingKey",
		payloadkey: "auth",
	});
});
