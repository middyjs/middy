import middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import httpJwt, {
	type Context,
	type Internal,
	type JWTPayload,
	type Options,
} from "./index.js";

test("use with default options", () => {
	const middleware = httpJwt();
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
	const middleware = httpJwt({
		internalKey: "hmacKey",
		algorithm: "HS256",
		audience: "https://api.example.com",
		issuer: "https://auth.example.com",
		typ: "at+jwt",
		clockTolerance: 5,
		requireExp: true,
		maxTokenAge: "1h",
		expectedClaims: { token_use: "access" },
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

test("use with maxTokenAge as seconds", () => {
	const middleware = httpJwt({
		internalKey: "hmacKey",
		algorithm: "HS256",
		maxTokenAge: 3600,
	});
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

test("use with internalKey option", () => {
	const middleware = httpJwt({
		internalKey: "signingKey",
		algorithm: "RS256",
	});
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

test("use with issuers map (single + multi entry, array algorithms, per-issuer override)", () => {
	const middleware = httpJwt({
		issuers: {
			"https://cognito-idp.us-east-1.amazonaws.com/POOL_A": {
				jwksUri:
					"https://cognito-idp.us-east-1.amazonaws.com/POOL_A/.well-known/jwks.json",
				audience: "clientA",
			},
			"https://cognito-idp.us-east-1.amazonaws.com/POOL_B": {
				jwksUri:
					"https://cognito-idp.us-east-1.amazonaws.com/POOL_B/.well-known/jwks.json",
				audience: ["clientB1", "clientB2"],
				algorithm: ["RS256", "ES256"],
			},
		},
		algorithm: "RS256",
		cacheExpiry: 600_000,
		cooldownDuration: 30_000,
		jwksTimeoutMs: 5000,
		disablePrefetch: false,
	});
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

test("allow specifying the event type", () => {
	const apiGatewayV1Middleware = httpJwt<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent,
			unknown,
			Error,
			Context<Options>,
			Internal
		>
	>();
	const apiGatewayV2Middleware = httpJwt<Options, APIGatewayProxyEventV2>();
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

test("options declare maxTokenAge and requireExp", () => {
	expect<Options["maxTokenAge"]>().type.toBe<string | number | undefined>();
	expect<Options["requireExp"]>().type.toBe<boolean | undefined>();
	expect<Options["typ"]>().type.toBe<string | null | undefined>();
	expect<indexModule.IssuerConfig["typ"]>().type.toBe<
		string | null | undefined
	>();
});

test("internal carries the payload and token under their keys", () => {
	middy()
		.use(httpJwt({ internalKey: "jwks" }))
		.before((request) => {
			expect(request.internal.jwt).type.toBe<JWTPayload>();
			expect(request.internal.jwtToken).type.toBe<string>();
		});
	middy()
		.use(httpJwt({ internalKey: "jwks", payloadKey: "auth", tokenKey: "raw" }))
		.before((request) => {
			expect(request.internal.auth).type.toBe<JWTPayload>();
			expect(request.internal.raw).type.toBe<string>();
		});
});

test("setToContext publishes the payload on middyContext", () => {
	middy()
		.use(
			httpJwt({ internalKey: "jwks", payloadKey: "auth", setToContext: true }),
		)
		.before((request) => {
			expect(request.context.middyContext.auth).type.toBe<JWTPayload>();
		});
});

test("rejects misspelled option", () => {
	expect(httpJwt).type.not.toBeCallableWith({
		internalKey: "jwks",
		payloadkey: "auth",
	});
});

test("httpJwtValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpJwtValidateOptions(options),
	).type.toBe<indexModule.Options>();
});
