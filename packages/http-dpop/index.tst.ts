import middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import httpDpop, {
	type Context,
	type DpopProofClaims,
	type Internal,
	type Options,
	verifyDpopProof,
} from "./index.js";

test("use with default options", () => {
	const middleware = httpDpop();
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
	const middleware = httpDpop({
		payloadKey: "paseto",
		tokenKey: "pasetoToken",
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
			Error,
			Context<{ setToContext: true; required: true }>,
			Internal<{ required: true }>
		>
	>();
});

test("use with a single algorithm", () => {
	const middleware = httpDpop({ algorithm: "ES256" });
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
	const apiGatewayV1Middleware = httpDpop<Options, APIGatewayEvent>();
	expect(apiGatewayV1Middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent,
			unknown,
			Error,
			Context<Options>,
			Internal
		>
	>();
	const apiGatewayV2Middleware = httpDpop<Options, APIGatewayProxyEventV2>();
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

test("verifyDpopProof requires the request method", () => {
	expect(
		verifyDpopProof("a.b.c", {
			method: "GET",
			url: "https://api.example.com/v1/things",
			accessToken: "token",
			algorithms: ["ES256"],
			maxAge: 60,
		}),
	).type.toBe<{ jkt: string; claims: DpopProofClaims }>();
	expect(verifyDpopProof).type.not.toBeCallableWith("a.b.c", {
		url: "https://api.example.com/v1/things",
	});
	expect(verifyDpopProof).type.not.toBeCallableWith("a.b.c");
});

test("httpDpopValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.httpDpopValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("internal carries the proof claims under proofKey", () => {
	middy()
		.use(httpDpop())
		.before((request) => {
			expect(request.internal.dpop).type.toBe<DpopProofClaims | undefined>();
		});
	middy()
		.use(httpDpop({ proofKey: "proof", required: true }))
		.before((request) => {
			expect(request.internal.proof).type.toBe<DpopProofClaims>();
		});
});

test("setToContext publishes the claims on middyContext", () => {
	middy()
		.use(httpDpop({ proofKey: "proof", setToContext: true, required: true }))
		.before((request) => {
			expect(request.context.middyContext.proof).type.toBe<DpopProofClaims>();
		});
});

test("rejects misspelled option", () => {
	expect(httpDpop).type.not.toBeCallableWith({ required: true, maxage: 60 });
});
