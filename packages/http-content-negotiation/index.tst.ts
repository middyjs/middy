import middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import httpContentNegotiationMiddleware, {
	type Context,
	type NegotiationResults,
} from "./index.js";

test("use with default options", () => {
	const middleware = httpContentNegotiationMiddleware();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const middleware = httpContentNegotiationMiddleware({
		parseCharsets: true,
		availableCharsets: ["utf-8", "iso-8859-1"],
		defaultToFirstCharset: true,
		parseEncodings: true,
		availableEncodings: ["gzip", "deflate"],
		defaultToFirstEncoding: true,
		parseLanguages: true,
		availableLanguages: ["it_IT", "en_GB"],
		defaultToFirstLanguage: true,
		parseMediaTypes: true,
		availableMediaTypes: ["application/xml", "application/json"],
		defaultToFirstMediaType: true,
		failOnMismatch: true,
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("default contextKey types middyContext", () => {
	handler.use(httpContentNegotiationMiddleware()).before(async (request) => {
		expect(
			request.context.middyContext["http-content-negotiation"],
		).type.toBe<NegotiationResults>();
	});
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(httpContentNegotiationMiddleware({ contextKey: "custom" }))
		.before(async (request) => {
			expect(
				request.context.middyContext.custom,
			).type.toBe<NegotiationResults>();
		});
});
