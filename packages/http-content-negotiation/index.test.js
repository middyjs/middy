import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import middy from "@middy/core";
import httpContentNegotiation, {
	httpContentNegotiationValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

describe("@middy/http-content-negotiation", () => {
	test("It should parse charset, encoding, language and media type", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				availableEncodings: undefined,
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
				"Accept-Encoding": "*/*",
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
				Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-8"],
				preferredCharset: "utf-8",
				preferredEncodings: ["*/*", "identity"],
				preferredEncoding: "*/*",
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
				preferredMediaTypes: ["text/x-dvi", "text/plain"],
				preferredMediaType: "text/x-dvi",
			},
		);
	});

	test("It should parse charset, encoding, language and media type with lowercase headers", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-16"],
				availableEncodings: ["br", "gzip"],
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				"accept-charset": "utf-16, iso-8859-5, unicode-1-1;q=0.8",
				"accept-encoding": "gzip, br, deflate",
				"accept-language": "da, en-ca;q=0.8, en;q=0.7",
				accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-16"],
				preferredCharset: "utf-16",
				preferredEncodings: ["gzip", "br"],
				preferredEncoding: "gzip",
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
				preferredMediaTypes: ["text/x-dvi", "text/plain"],
				preferredMediaType: "text/x-dvi",
			},
		);
	});

	test("It should default charset, encoding, language and media type when there is a mismatch", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-16"],
				defaultToFirstCharset: true,
				availableEncodings: ["br", "gzip"],
				defaultToFirstEncoding: true,
				availableLanguages: ["en"],
				defaultToFirstLanguage: true,
				availableMediaTypes: ["text/plain"],
				defaultToFirstMediaType: true,
			}),
		);

		const event = {
			headers: {
				"accept-charset": "iso-8859-5, unicode-1-1;q=0.8",
				"accept-encoding": "deflate, identity;q=0",
				"accept-language": "da, fr;q=0.8",
				accept: "text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: [],
				preferredCharset: "utf-16",
				preferredEncodings: [],
				preferredEncoding: "br",
				preferredLanguages: [],
				preferredLanguage: "en",
				preferredMediaTypes: [],
				preferredMediaType: "text/plain",
			},
		);
	});

	test("It should prefer identity when the request has no Accept-Encoding header", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableEncodings: ["br", "gzip"],
			}),
		);

		const resultingContext = await handler(
			{ headers: { host: "example.org" } },
			defaultContext,
		);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredEncodings: ["identity"],
				preferredEncoding: "identity",
			},
		);
	});

	test("It should prefer identity over the first available encoding when the request accepts neither", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableEncodings: ["br", "gzip"],
				defaultToFirstEncoding: true,
			}),
		);

		for (const acceptEncoding of ["identity", "deflate", "gzip;q=0, br;q=0"]) {
			const resultingContext = await handler(
				{ headers: { "accept-encoding": acceptEncoding } },
				defaultContext,
			);

			deepStrictEqual(
				{ ...resultingContext },
				{
					preferredEncodings: ["identity"],
					preferredEncoding: "identity",
				},
			);
		}
	});

	test("It should throw 406 when the request refuses identity and every available encoding", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableEncodings: ["br", "gzip"],
			}),
		);

		for (const acceptEncoding of ["deflate, identity;q=0", "*;q=0"]) {
			let thrown;
			try {
				await handler(
					{ headers: { "accept-encoding": acceptEncoding } },
					defaultContext,
				);
			} catch (e) {
				thrown = e;
			}
			strictEqual(thrown.statusCode, 406);
			deepStrictEqual(thrown.cause.data, {
				reason: "Unsupported Encoding. Acceptable values: br, gzip",
				"Accept-Encoding": acceptEncoding,
			});
		}
	});

	test("It should keep the negotiated encodings when one of the available encodings is acceptable", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableEncodings: ["br", "gzip"],
			}),
		);

		const resultingContext = await handler(
			{ headers: { "accept-encoding": "deflate, gzip;q=0.5" } },
			defaultContext,
		);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredEncodings: ["gzip"],
				preferredEncoding: "gzip",
			},
		);
	});

	// VPC Lattice V2 delivers every header value as an array.
	// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html
	test("It should parse array header values from VPC Lattice V2", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				availableEncodings: ["gzip"],
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			version: "2.0",
			method: "GET",
			headers: {
				"accept-charset": ["utf-8"],
				"accept-encoding": ["br", "gzip"],
				"accept-language": ["da", "en-ca;q=0.8"],
				accept: ["text/plain; q=0.5", "text/x-dvi; q=0.8"],
			},
		};

		const resultingContext = await handler(event, defaultContext);

		strictEqual(resultingContext.preferredCharset, "utf-8");
		strictEqual(resultingContext.preferredEncoding, "gzip");
		strictEqual(resultingContext.preferredLanguage, "en-ca");
		deepStrictEqual(resultingContext.preferredMediaTypes, [
			"text/x-dvi",
			"text/plain",
		]);
	});

	test("It should skip the middleware if no headers are sent", async (t) => {
		const handler = middy((event, context) => event);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				availableEncodings: undefined,
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			foo: "bar",
		};

		const resultingEvent = await handler(event, defaultContext);

		deepStrictEqual(resultingEvent, { foo: "bar" });
	});

	test("It should not parse charset if disabled", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				availableEncodings: undefined,
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
				"Accept-Encoding": "*/*",
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
				Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredEncodings: ["*/*", "identity"],
				preferredEncoding: "*/*",
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
				preferredMediaTypes: ["text/x-dvi", "text/plain"],
				preferredMediaType: "text/x-dvi",
			},
		);
	});

	test("It should not parse encoding if disabled", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				parseEncodings: undefined,
				availableLanguages: ["en-ca"],
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
				"Accept-Encoding": "*/*",
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
				Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-8"],
				preferredCharset: "utf-8",
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
				preferredMediaTypes: ["text/x-dvi", "text/plain"],
				preferredMediaType: "text/x-dvi",
			},
		);
	});

	test("It should not parse language if disabled", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				availableEncodings: undefined,
				parseLanguages: false,
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
				"Accept-Encoding": "*/*",
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
				Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-8"],
				preferredCharset: "utf-8",
				preferredEncodings: ["*/*", "identity"],
				preferredEncoding: "*/*",
				preferredMediaTypes: ["text/x-dvi", "text/plain"],
				preferredMediaType: "text/x-dvi",
			},
		);
	});

	test("It should not parse media types if disabled", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-8"],
				availableEncodings: undefined,
				availableLanguages: ["en-ca"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
				"Accept-Encoding": "*/*",
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
				Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-8"],
				preferredCharset: "utf-8",
				preferredEncodings: ["*/*", "identity"],
				preferredEncoding: "*/*",
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
			},
		);
	});

	test("It should fail when mismatching", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				Accept: "application/json",
			},
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-content-negotiation");
			strictEqual(e.message, "Not Acceptable");
			strictEqual(
				e.cause.data.reason,
				"Unsupported MediaType. Acceptable values: text/plain, text/x-dvi",
			);
		}
	});

	test("It should error when unfound preferred locale", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				availableLanguages: ["en-CA"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "en-us",
			},
		};
		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-content-negotiation");
			strictEqual(e.message, "Not Acceptable");
			strictEqual(
				e.cause.data.reason,
				"Unsupported Language. Acceptable values: en-CA",
			);
		}
	});

	test("It should find language when locale passed in when fallback set", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				availableLanguages: ["en-ca", "en"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "en-US",
			},
		};
		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredLanguages: ["en"],
				preferredLanguage: "en",
			},
		);
	});

	test("It should find locale when locale passed in when fallback set", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				availableLanguages: ["en-ca", "en"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "en-CA",
			},
		};
		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredLanguages: ["en-ca", "en"],
				preferredLanguage: "en-ca",
			},
		);
	});

	test("It should find language when locale passed in", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				availableLanguages: ["en"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "en-us",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredLanguages: ["en"],
				preferredLanguage: "en",
			},
		);
	});

	test("It should find locale when language passed in", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				availableLanguages: ["en-ca"],
				parseMediaTypes: false,
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "en",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredLanguages: ["en-ca"],
				preferredLanguage: "en-ca",
			},
		);
	});

	test("It should read the uppercase Accept-Charset header value for negotiation", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseEncodings: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableCharsets: ["iso-8859-5", "utf-8"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8;q=1, iso-8859-5;q=0.5",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredCharsets: ["utf-8", "iso-8859-5"],
				preferredCharset: "utf-8",
			},
		);
	});

	test("It should not set preferredCharsets when parseCharsets is false", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableCharsets: ["utf-8"],
			}),
		);

		const event = {
			headers: {
				"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
			},
		};

		const resultingContext = await handler(event, {
			getRemainingTimeInMillis: () => 1000,
		});
		deepStrictEqual({ ...resultingContext }, {});
	});

	test("It should not set preferredEncodings when parseEncodings is false", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableEncodings: ["gzip"],
			}),
		);

		const event = {
			headers: {
				"Accept-Encoding": "gzip, br, deflate",
			},
		};

		const resultingContext = await handler(event, {
			getRemainingTimeInMillis: () => 1000,
		});
		deepStrictEqual({ ...resultingContext }, {});
	});

	test("It should not set preferredLanguages when parseLanguages is false", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableLanguages: ["en-ca"],
			}),
		);

		const event = {
			headers: {
				"Accept-Language": "da, en-ca;q=0.8, en;q=0.7",
			},
		};

		const resultingContext = await handler(event, {
			getRemainingTimeInMillis: () => 1000,
		});
		deepStrictEqual({ ...resultingContext }, {});
	});

	test("It should not set preferredMediaTypes when parseMediaTypes is false", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				parseMediaTypes: false,
				availableMediaTypes: ["text/plain"],
			}),
		);

		const event = {
			headers: {
				Accept: "text/plain; q=0.5, text/html",
			},
		};

		const resultingContext = await handler(event, {
			getRemainingTimeInMillis: () => 1000,
		});
		deepStrictEqual({ ...resultingContext }, {});
	});

	test("It should throw 406 by default on an unmatchable header", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				Accept: "application/json",
			},
		};

		let thrown;
		try {
			await handler(event, defaultContext);
		} catch (e) {
			thrown = e;
		}
		ok(thrown, "expected a 406 to be thrown");
		strictEqual(thrown.statusCode, 406);
		strictEqual(thrown.cause.package, "@middy/http-content-negotiation");
	});

	test("It should attach offending header name/value to the 406 cause data", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				availableMediaTypes: ["text/plain", "text/x-dvi"],
			}),
		);

		const event = {
			headers: {
				Accept: "application/json",
			},
		};

		let thrown;
		try {
			await handler(event, defaultContext);
		} catch (e) {
			thrown = e;
		}
		ok(thrown, "expected a 406 to be thrown");
		deepStrictEqual(thrown.cause.data, {
			reason:
				"Unsupported MediaType. Acceptable values: text/plain, text/x-dvi",
			Accept: "application/json",
		});
	});

	test("It should not throw on mismatch when failOnMismatch is false", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				availableMediaTypes: ["text/plain", "text/x-dvi"],
				failOnMismatch: false,
			}),
		);

		const event = {
			headers: {
				Accept: "application/json",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredMediaTypes: [],
				preferredMediaType: undefined,
			},
		);
	});

	test("It should return quietly when availableValues is an empty array on a mismatch", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				availableMediaTypes: [],
			}),
		);

		const event = {
			headers: {
				Accept: "application/json",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredMediaTypes: [],
				preferredMediaType: undefined,
			},
		);
	});

	test("It should return quietly when availableValues is missing on a mismatch", async (t) => {
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				parseCharsets: false,
				parseEncodings: false,
				parseLanguages: false,
				availableMediaTypes: undefined,
			}),
		);

		const event = {
			headers: {
				Accept: "",
			},
		};

		const resultingContext = await handler(event, defaultContext);
		deepStrictEqual(
			{ ...resultingContext },
			{
				preferredMediaTypes: [],
				preferredMediaType: undefined,
			},
		);
	});

	test("httpContentNegotiationValidateOptions accepts valid options and rejects typos", () => {
		httpContentNegotiationValidateOptions({
			parseCharsets: true,
			availableLanguages: ["en"],
			failOnMismatch: false,
		});
		httpContentNegotiationValidateOptions({});
		try {
			httpContentNegotiationValidateOptions({ parseCharset: true });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/http-content-negotiation");
		}
	});

	test("httpContentNegotiationValidateOptions rejects wrong type", () => {
		try {
			httpContentNegotiationValidateOptions({ availableLanguages: "en" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("availableLanguages"));
		}
	});

	test("httpContentNegotiationValidateOptions accepts known encodings and rejects unknown", () => {
		httpContentNegotiationValidateOptions({
			availableEncodings: ["br", "deflate", "gzip", "zstd", "identity"],
		});
		try {
			httpContentNegotiationValidateOptions({
				availableEncodings: ["compress"],
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("availableEncodings"));
		}
	});

	const expectInvalidOption = (options, expectedMessage) => {
		try {
			httpContentNegotiationValidateOptions(options);
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/http-content-negotiation");
			strictEqual(
				e.message,
				expectedMessage,
				`expected "${expectedMessage}" got "${e.message}"`,
			);
		}
	};

	test("httpContentNegotiationValidateOptions rejects non-array availableCharsets", () => {
		expectInvalidOption(
			{ availableCharsets: "utf-8" },
			"Option 'availableCharsets' must be array",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-string availableCharsets item", () => {
		expectInvalidOption(
			{ availableCharsets: [1] },
			"Option 'availableCharsets[0]' must be string",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-array availableMediaTypes", () => {
		expectInvalidOption(
			{ availableMediaTypes: "text/plain" },
			"Option 'availableMediaTypes' must be array",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-string availableMediaTypes item", () => {
		expectInvalidOption(
			{ availableMediaTypes: [1] },
			"Option 'availableMediaTypes[0]' must be string",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean parseCharsets", () => {
		expectInvalidOption(
			{ parseCharsets: "yes" },
			"Option 'parseCharsets' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean defaultToFirstCharset", () => {
		expectInvalidOption(
			{ defaultToFirstCharset: "yes" },
			"Option 'defaultToFirstCharset' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean parseEncodings", () => {
		expectInvalidOption(
			{ parseEncodings: "yes" },
			"Option 'parseEncodings' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean defaultToFirstEncoding", () => {
		expectInvalidOption(
			{ defaultToFirstEncoding: "yes" },
			"Option 'defaultToFirstEncoding' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean parseLanguages", () => {
		expectInvalidOption(
			{ parseLanguages: "yes" },
			"Option 'parseLanguages' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean defaultToFirstLanguage", () => {
		expectInvalidOption(
			{ defaultToFirstLanguage: "yes" },
			"Option 'defaultToFirstLanguage' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean parseMediaTypes", () => {
		expectInvalidOption(
			{ parseMediaTypes: "yes" },
			"Option 'parseMediaTypes' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions rejects non-boolean defaultToFirstMediaType", () => {
		expectInvalidOption(
			{ defaultToFirstMediaType: "yes" },
			"Option 'defaultToFirstMediaType' must be boolean",
		);
	});

	test("httpContentNegotiationValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		httpContentNegotiationValidateOptions({ contextKey: "custom" });
		try {
			httpContentNegotiationValidateOptions({ contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should leave the preferred value unset on a mismatch when defaultToFirst is off", async (t) => {
		// The mirror of the defaultToFirst*: true test above. Without it the `false`
		// defaults are never exercised on a mismatching header, so flipping them
		// changes nothing any assertion can see.
		const handler = middy(
			(event, context) => context.middyContext["http-content-negotiation"],
		);
		handler.use(
			httpContentNegotiation({
				availableCharsets: ["utf-16"],
				availableEncodings: ["br"],
				availableLanguages: ["en"],
				availableMediaTypes: ["text/plain"],
				// Otherwise the mismatch raises a 406 before the context is readable.
				failOnMismatch: false,
			}),
		);

		const event = {
			headers: {
				"accept-charset": "iso-8859-5",
				"accept-encoding": "deflate, identity;q=0",
				"accept-language": "da",
				accept: "text/plain",
			},
		};

		const resultingContext = await handler(event, defaultContext);

		strictEqual(resultingContext.preferredCharset, undefined);
		strictEqual(resultingContext.preferredEncoding, undefined);
		strictEqual(resultingContext.preferredLanguage, undefined);
	});

	test("httpContentNegotiationValidateOptions accepts the documented available values", () => {
		httpContentNegotiationValidateOptions({
			availableCharsets: ["iso-8859-5", "utf-8", "utf-16"],
			availableEncodings: ["br", "deflate", "gzip", "zstd", "identity"],
			availableLanguages: ["it-it", "fr-fr", "en", "en-CA", "zh-Hant-TW"],
			availableMediaTypes: [
				"text/plain",
				"text/x-dvi",
				"text/html;level=1",
				"text/html ;level=1",
				"text/html; level=1",
				'text/plain;charset="utf-8"',
				"application/vnd.api+json",
			],
			contextKey: "http-content-negotiation",
		});
	});

	test("httpContentNegotiationValidateOptions rejects a malformed available value", () => {
		for (const [options, path] of [
			[{ availableCharsets: ["utf 8"] }, "availableCharsets[0]"],
			[{ availableLanguages: ["en_US"] }, "availableLanguages[0]"],
			[{ availableLanguages: ["en-"] }, "availableLanguages[0]"],
			[{ availableLanguages: ["toolonglang"] }, "availableLanguages[0]"],
			[{ availableMediaTypes: ["text"] }, "availableMediaTypes[0]"],
			[{ availableMediaTypes: [" text/plain"] }, "availableMediaTypes[0]"],
			[
				{ availableMediaTypes: ["text/plain\r\nX-Injected: 1"] },
				"availableMediaTypes[0]",
			],
			[{ contextKey: "a b" }, "contextKey"],
		]) {
			throws(() => httpContentNegotiationValidateOptions(options), {
				name: "TypeError",
				message: new RegExp(
					`^Option '${RegExp.escape(path)}' must match pattern `,
				),
			});
		}
	});

	test("httpContentNegotiationValidateOptions bounds string options to 1024 characters", () => {
		const language = `a${"-abcdefgh".repeat(113)}`;
		const charset = "c".repeat(1024);
		const mediaType = `text/${"a".repeat(126)};p=${"v".repeat(1024 - 134)}`;
		strictEqual(language.length, 1018);
		strictEqual(mediaType.length, 1024);
		httpContentNegotiationValidateOptions({
			availableCharsets: [charset],
			availableLanguages: [language],
			availableMediaTypes: [mediaType],
			contextKey: "k".repeat(1024),
		});
		for (const [options, path] of [
			[{ availableCharsets: [`${charset}c`] }, "availableCharsets[0]"],
			[
				{ availableLanguages: [`${language}-abcdefg`] },
				"availableLanguages[0]",
			],
			[{ availableMediaTypes: [`${mediaType}v`] }, "availableMediaTypes[0]"],
			[{ contextKey: "k".repeat(1025) }, "contextKey"],
		]) {
			throws(() => httpContentNegotiationValidateOptions(options), {
				name: "TypeError",
				message: `Option '${path}' must have length <= 1024`,
			});
		}
	});

	test("httpContentNegotiationValidateOptions caps the available lists and rejects duplicates", () => {
		const many = Array.from({ length: 1025 }, (_, i) => `c${i}`);
		httpContentNegotiationValidateOptions({
			availableCharsets: many.slice(0, 1024),
		});
		for (const key of [
			"availableCharsets",
			"availableLanguages",
			"availableMediaTypes",
		]) {
			throws(() => httpContentNegotiationValidateOptions({ [key]: many }), {
				name: "TypeError",
				message: `Option '${key}' must have <= 1024 items`,
			});
		}
		for (const [key, value] of [
			["availableCharsets", "utf-8"],
			["availableEncodings", "gzip"],
			["availableLanguages", "en"],
			["availableMediaTypes", "text/plain"],
		]) {
			throws(
				() => httpContentNegotiationValidateOptions({ [key]: [value, value] }),
				{ name: "TypeError", message: `Duplicate item at '${key}[1]'` },
			);
		}
		throws(
			() =>
				httpContentNegotiationValidateOptions({
					availableEncodings: [
						"br",
						"deflate",
						"gzip",
						"zstd",
						"identity",
						"br",
					],
				}),
			{
				name: "TypeError",
				message: "Option 'availableEncodings' must have <= 5 items",
			},
		);
	});

	test("httpContentNegotiationValidateOptions accepts any visible ASCII contextKey", () => {
		httpContentNegotiationValidateOptions({ contextKey: "@middy/x" });
		throws(() => httpContentNegotiationValidateOptions({ contextKey: "" }), {
			name: "TypeError",
			message: /^Option 'contextKey' must match pattern /,
		});
	});
});
