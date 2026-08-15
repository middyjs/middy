import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpContentNegotiation, {
	httpContentNegotiationValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should parse charset, encoding, language and media type", async (t) => {
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-8"],
		preferredCharset: "utf-8",
		preferredEncodings: ["*/*", "identity"],
		preferredEncoding: "*/*",
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
		preferredMediaTypes: ["text/x-dvi", "text/plain"],
		preferredMediaType: "text/x-dvi",
	});
});

test("It should parse charset, encoding, language and media type with lowercase headers", async (t) => {
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-16"],
		preferredCharset: "utf-16",
		preferredEncodings: ["gzip", "br"],
		preferredEncoding: "gzip",
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
		preferredMediaTypes: ["text/x-dvi", "text/plain"],
		preferredMediaType: "text/x-dvi",
	});
});

test("It should default charset, encoding, language and media type when there is a mismatch", async (t) => {
	const handler = middy((event, context) => context);
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
			"accept-encoding": "deflate",
			"accept-language": "da, fr;q=0.8",
			accept: "text/html, text/x-dvi; q=0.8, text/x-c",
		},
	};

	const resultingContext = await handler(event, defaultContext);

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: [],
		preferredCharset: "utf-16",
		preferredEncodings: [],
		preferredEncoding: "br",
		preferredLanguages: [],
		preferredLanguage: "en",
		preferredMediaTypes: [],
		preferredMediaType: "text/plain",
	});
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
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredEncodings: ["*/*", "identity"],
		preferredEncoding: "*/*",
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
		preferredMediaTypes: ["text/x-dvi", "text/plain"],
		preferredMediaType: "text/x-dvi",
	});
});

test("It should not parse encoding if disabled", async (t) => {
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-8"],
		preferredCharset: "utf-8",
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
		preferredMediaTypes: ["text/x-dvi", "text/plain"],
		preferredMediaType: "text/x-dvi",
	});
});

test("It should not parse language if disabled", async (t) => {
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-8"],
		preferredCharset: "utf-8",
		preferredEncodings: ["*/*", "identity"],
		preferredEncoding: "*/*",
		preferredMediaTypes: ["text/x-dvi", "text/plain"],
		preferredMediaType: "text/x-dvi",
	});
});

test("It should not parse media types if disabled", async (t) => {
	const handler = middy((event, context) => context);
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

	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-8"],
		preferredCharset: "utf-8",
		preferredEncodings: ["*/*", "identity"],
		preferredEncoding: "*/*",
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
	});
});

test("It should fail when mismatching", async (t) => {
	const handler = middy((event, context) => context);
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
		strictEqual(
			e.message,
			"Unsupported MediaType. Acceptable values: text/plain, text/x-dvi",
		);
	}
});

test("It should error when unfound preferred locale", async (t) => {
	const handler = middy((event, context) => context);
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
		strictEqual(e.message, "Unsupported Language. Acceptable values: en-CA");
	}
});

test("It should find language when locale passed in when fallback set", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredLanguages: ["en"],
		preferredLanguage: "en",
	});
});

test("It should find locale when locale passed in when fallback set", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredLanguages: ["en-ca", "en"],
		preferredLanguage: "en-ca",
	});
});

test("It should find language when locale passed in", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredLanguages: ["en"],
		preferredLanguage: "en",
	});
});

test("It should find locale when language passed in", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredLanguages: ["en-ca"],
		preferredLanguage: "en-ca",
	});
});

test("It should read the uppercase Accept-Charset header value for negotiation", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredCharsets: ["utf-8", "iso-8859-5"],
		preferredCharset: "utf-8",
	});
});

test("It should not set preferredCharsets when parseCharsets is false", async (t) => {
	const handler = middy((event, context) => context);
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

	const context = { getRemainingTimeInMillis: () => 1000 };
	const resultingContext = await handler(event, context);
	deepStrictEqual(resultingContext, {
		getRemainingTimeInMillis: context.getRemainingTimeInMillis,
	});
});

test("It should not set preferredEncodings when parseEncodings is false", async (t) => {
	const handler = middy((event, context) => context);
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

	const context = { getRemainingTimeInMillis: () => 1000 };
	const resultingContext = await handler(event, context);
	deepStrictEqual(resultingContext, {
		getRemainingTimeInMillis: context.getRemainingTimeInMillis,
	});
});

test("It should not set preferredLanguages when parseLanguages is false", async (t) => {
	const handler = middy((event, context) => context);
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

	const context = { getRemainingTimeInMillis: () => 1000 };
	const resultingContext = await handler(event, context);
	deepStrictEqual(resultingContext, {
		getRemainingTimeInMillis: context.getRemainingTimeInMillis,
	});
});

test("It should not set preferredMediaTypes when parseMediaTypes is false", async (t) => {
	const handler = middy((event, context) => context);
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

	const context = { getRemainingTimeInMillis: () => 1000 };
	const resultingContext = await handler(event, context);
	deepStrictEqual(resultingContext, {
		getRemainingTimeInMillis: context.getRemainingTimeInMillis,
	});
});

test("It should throw 406 by default on an unmatchable header", async (t) => {
	const handler = middy((event, context) => context);
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
	const handler = middy((event, context) => context);
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
	deepStrictEqual(thrown.cause.data, { Accept: "application/json" });
});

test("It should not throw on mismatch when failOnMismatch is false", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredMediaTypes: [],
		preferredMediaType: undefined,
	});
});

test("It should return quietly when availableValues is an empty array on a mismatch", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredMediaTypes: [],
		preferredMediaType: undefined,
	});
});

test("It should return quietly when availableValues is missing on a mismatch", async (t) => {
	const handler = middy((event, context) => context);
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
	deepStrictEqual(resultingContext, {
		...defaultContext,
		preferredMediaTypes: [],
		preferredMediaType: undefined,
	});
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
		httpContentNegotiationValidateOptions({ availableEncodings: ["compress"] });
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
