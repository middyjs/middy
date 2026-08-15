import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { createError } from "@middy/util";
import middy from "../core/index.js";
import httpContentNegotiation from "../http-content-negotiation/index.js";
import httpErrorHandler from "../http-error-handler/index.js";
import httpResponseSerializer, {
	httpResponseSerializerValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const standardConfiguration = {
	serializers: [
		{
			regex: /^application\/xml$/,
			serializer: ({ body }) => `<message>${body}</message>`,
		},
		{
			regex: /^application\/json$/,
			serializer: ({ body }) => JSON.stringify({ message: body }),
		},
		{
			regex: /^text\/plain$/,
			serializer: ({ body }) => body,
		},
	],
	defaultContentType: "application/json",
};

const createHttpResponse = () => ({
	statusCode: 200,
	body: "Hello World",
});

for (const [key] of [["Content-Type"], ["content-type"]]) {
	test(`${key} skips response serialization`, async (t) => {
		const handlerResponse = Object.assign({}, createHttpResponse(), {
			headers: {
				[key]: "text/plain",
			},
		});
		const handler = middy((event, context) =>
			Object.assign({}, handlerResponse),
		);

		handler.use(httpResponseSerializer(standardConfiguration));

		const event = {
			headers: {},
		};
		const response = await handler(event, { ...defaultContext });

		deepStrictEqual(response, handlerResponse);
	});
}

for (const [accept, result] of [
	[undefined, '{"message":"Hello World"}'],
	[
		"application/xml, text/x-dvi; q=0.8, text/x-c",
		"<message>Hello World</message>",
	],
	[
		"text/x-dvi; q=0.8, application/xml, text/x-c",
		"<message>Hello World</message>",
	],
	["text/x-dvi, application/xml, text/x-c", "<message>Hello World</message>"],
	["application/json, text/plain, */*", '{"message":"Hello World"}'],
	["*/*", '{"message":"Hello World"}'],
	["text/x-dvi, */*", '{"message":"Hello World"}'],
	["text/plain, text/x-c", "Hello World"],
]) {
	test(`${accept} returns ${result}`, async (t) => {
		const handler = middy()
			.use(httpContentNegotiation())
			.use(httpResponseSerializer(standardConfiguration))
			.handler(createHttpResponse);

		const event = {
			headers: {
				Accept: accept,
			},
		};

		const response = await handler(event, { ...defaultContext });

		strictEqual(response.body, result);
	});
}

test("missing headers skips", async (t) => {
	const handler = middy()
		.use(httpResponseSerializer(standardConfiguration))
		.handler(createHttpResponse);

	const event = {};

	const response = await handler(event, { ...defaultContext });

	strictEqual(response.body, '{"message":"Hello World"}');
});

test("It should use the defaultContentType when no accept preferences are given", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(httpResponseSerializer(standardConfiguration));

	const event = {
		headers: {},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": standardConfiguration.defaultContentType,
		},
		body: '{"message":"Hello World"}',
	});
});

test("It should allow the return of the entire response", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /^application\/json$/,
					serializer: (response) => {
						response.body = JSON.stringify({ message: response.body });
						return response;
					},
				},
			],
			defaultContentType: "application/json",
		}),
	);

	const event = {
		headers: {},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": standardConfiguration.defaultContentType,
		},
		body: '{"message":"Hello World"}',
	});
});

test("It should not crash when a serializer returns null", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(
		httpResponseSerializer({
			serializers: [{ regex: /^application\/json$/, serializer: () => null }],
			defaultContentType: "application/json",
		}),
	);

	const event = { headers: {} };
	const response = await handler(event, { ...defaultContext });

	strictEqual(response.body, null);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("It should use the defaultContentType when no matching accept preferences are found", async (t) => {
	const handler = middy((event, context) => {
		return createHttpResponse();
	});

	handler
		.use(httpContentNegotiation())
		.use(httpResponseSerializer(standardConfiguration));

	const event = {
		headers: {
			Accept: "application/java, text/x-dvi; q=0.8, text/x-c",
		},
	};

	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": standardConfiguration.defaultContentType,
		},
		body: '{"message":"Hello World"}',
	});
});

test("It should use `context.preferredMediaTypes` instead of the defaultContentType", async (t) => {
	const handler = middy((event, context) => {
		return createHttpResponse();
	});

	handler
		.use(httpContentNegotiation())
		.use(httpResponseSerializer(standardConfiguration));

	const event = {
		headers: {
			Accept: "text/plain",
		},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": "text/plain",
		},
		body: "Hello World",
	});
});

test("It should pass-through when no preference or defaultContentType is found", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(
		httpResponseSerializer({
			serializers: standardConfiguration.serializers,
		}),
	);

	const event = {
		headers: {},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {},
		body: "Hello World",
	});
});

test("It should not pass-through when request content-type is set", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(httpResponseSerializer(standardConfiguration));

	const event = {
		headers: {
			"Content-Type": "application/xml",
		},
	};

	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": standardConfiguration.defaultContentType,
		},
		body: '{"message":"Hello World"}',
	});
});

test('It should replace the response object when the serializer returns an object with a "body" attribute', async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /^text\/plain$/,
					serializer: (response) =>
						Object.assign({}, response, {
							statusCode: 204,
							body: null,
						}),
				},
			],
			defaultContentType: "text/plain",
		}),
	);

	const event = {
		headers: {},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Content-Type": "text/plain",
		},
		body: null,
	});
});

test("It should work with `http-error-handler` middleware", async (t) => {
	const handler = middy((event, context) => {
		throw createError(422);
	});

	handler
		.use(httpResponseSerializer(standardConfiguration))
		.use(httpErrorHandler({ logger: false }));

	const event = {
		headers: {},
	};
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should skip if the response is undefined form 502 error", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("test");
	});

	handler.use(httpResponseSerializer(standardConfiguration));

	const event = {
		headers: {},
	};
	try {
		await handler(event, { ...defaultContext });
	} catch (e) {
		deepStrictEqual(e.message, "test");
	}
});

test("It should return false when response body is falsey", async (t) => {
	const handler = middy((event, context) => {
		return false;
	});

	const event = {
		headers: {
			Accept: "text/plain",
		},
	};
	handler
		.use(httpContentNegotiation())
		.use(httpResponseSerializer(standardConfiguration));
	const response = await handler(event, { ...defaultContext });

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": "text/plain",
		},
		body: false,
	});
});

test("httpResponseSerializerValidateOptions accepts valid options and rejects typos", () => {
	httpResponseSerializerValidateOptions({
		serializers: [],
		defaultContentType: "application/json",
	});
	httpResponseSerializerValidateOptions({});
	try {
		httpResponseSerializerValidateOptions({ defaulContentType: "x" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-response-serializer");
	}
});

test("httpResponseSerializerValidateOptions rejects wrong type", () => {
	try {
		httpResponseSerializerValidateOptions({ serializers: "not-an-array" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("serializers"));
	}
});

test("default serializers list is empty and defaultContentType undefined when no options given", async (t) => {
	const handler = middy((event, context) => createHttpResponse());

	handler.use(httpResponseSerializer());

	const event = { headers: {} };
	const response = await handler(event, { ...defaultContext });

	// With empty default serializers and no defaultContentType, nothing matches
	// and the response passes through unserialized with no Content-Type header.
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {},
		body: "Hello World",
	});
});

test("httpResponseSerializerValidateOptions requires 'regex' on each serializer item", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: [{ serializer: () => "x" }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("regex"));
	}
});

test("httpResponseSerializerValidateOptions requires 'serializer' on each serializer item", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: [{ regex: /^x$/ }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("serializer"));
	}
});

test("httpResponseSerializerValidateOptions requires each serializer item to be an object", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: ["not-an-object"],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("serializers[0]"));
		ok(e.message.includes("object"));
	}
});

test("httpResponseSerializerValidateOptions requires regex to be a RegExp instance", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: [{ regex: "^application/json$", serializer: () => "x" }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("regex"));
		ok(e.message.includes("RegExp"));
	}
});

test("httpResponseSerializerValidateOptions requires serializer to be a Function instance", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: [{ regex: /^application\/json$/, serializer: "notfn" }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("serializer"));
		ok(e.message.includes("Function"));
	}
});

test("httpResponseSerializerValidateOptions accepts a valid serializer item", () => {
	httpResponseSerializerValidateOptions({
		serializers: [{ regex: /^application\/json$/, serializer: () => "x" }],
	});
});

test("httpResponseSerializerValidateOptions rejects unknown keys on a serializer item", () => {
	try {
		httpResponseSerializerValidateOptions({
			serializers: [
				{ regex: /^application\/json$/, serializer: () => "x", extra: true },
			],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("extra"));
	}
});

test("preferredMediaTypes fallback is empty when context.preferredMediaTypes is absent", async (t) => {
	// No http-content-negotiation, so request.context.preferredMediaTypes is
	// nullish. With a catch-all serializer regex and NO defaultContentType, the
	// candidate `types` list is exactly the preferredMediaTypes fallback plus
	// the (undefined) defaultContentType. The real empty `[]` fallback means the
	// first (and only) candidate matched is `undefined`. A catch-all regex still
	// matches and the body is serialized, but the non-string `undefined` candidate
	// fails the media-type grammar so no Content-Type header is reflected.
	const handler = middy((event, context) => createHttpResponse());
	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /.*/,
					serializer: ({ body }) => `serialized:${body}`,
				},
			],
		}),
	);

	const response = await handler({ headers: {} }, { ...defaultContext });

	strictEqual(response.body, "serialized:Hello World");
	// The matched candidate type is undefined: not a valid media type, so no
	// Content-Type is echoed.
	ok(!Object.hasOwn(response.headers, "Content-Type"));
});

test("over-length attacker media type is skipped and not reflected (#9 ReDoS)", async (t) => {
	// A catastrophic-backtracking regex a developer might register. Without a
	// length cap, a long attacker subtype drives exponential CPU. The over-length
	// candidate must be skipped BEFORE any s.regex.test() runs, so no hang and no
	// Content-Type is reflected from it. This deliberate ReDoS fixture trips the
	// js/redos query; the alert is dismissed in code scanning as test-only.
	const evilRegex = /^x\/(a+)+$/;
	const testedValues = [];
	const countingRegex = {
		lastIndex: 0,
		test(value) {
			testedValues.push(value);
			return evilRegex.test(value);
		},
	};

	// 200 'a' chars: well over the cap; would hang against the evil regex.
	const longSubtype = `x/${"a".repeat(200)}b`;

	const handler = middy((event, context) => createHttpResponse());
	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: countingRegex,
					serializer: ({ body }) => `serialized:${body}`,
				},
			],
		}),
	);

	// Simulate http-content-negotiation putting the attacker subtype first.
	const event = { headers: {} };
	const context = {
		...defaultContext,
		preferredMediaTypes: [longSubtype],
	};

	const start = Date.now();
	const response = await handler(event, context);
	const elapsed = Date.now() - start;

	// The over-length candidate must never reach the serializer regex.
	ok(!testedValues.includes(longSubtype));
	// No Content-Type reflected from the attacker value.
	ok(!Object.hasOwn(response.headers, "Content-Type"));
	// Body untouched (no serializer matched).
	strictEqual(response.body, "Hello World");
	// Must not hang.
	ok(elapsed < 1000);
});

test("attacker media type with invalid chars is not reflected verbatim (#10)", async (t) => {
	// A permissive serializer regex matches an attacker-derived media type that
	// contains characters disallowed by the media-type grammar (< >). The raw
	// value must NOT be echoed into Content-Type; the matched-but-invalid value
	// is dropped so a downstream default applies (here: no Content-Type set).
	const handler = middy((event, context) => createHttpResponse());
	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /.*/,
					serializer: ({ body }) => `serialized:${body}`,
				},
			],
		}),
	);

	const event = { headers: {} };
	const context = {
		...defaultContext,
		preferredMediaTypes: ["x/evil<script>json"],
	};

	const response = await handler(event, context);

	// The serializer still ran (it matched), but the invalid value is not echoed.
	strictEqual(response.body, "serialized:Hello World");
	ok(!Object.hasOwn(response.headers, "Content-Type"));
});

test("valid media type still matches and sets Content-Type (#10 grammar pass)", async (t) => {
	const handler = middy((event, context) => createHttpResponse());
	handler.use(httpResponseSerializer(standardConfiguration));

	const event = { headers: {} };
	const context = {
		...defaultContext,
		preferredMediaTypes: ["application/json"],
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Content-Type": "application/json",
		},
		body: '{"message":"Hello World"}',
	});
});

test("onError skips serialization when request.response is undefined", async (t) => {
	const serializerCalls = [];
	const handler = middy((event, context) => {
		throw new Error("boom");
	});

	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /.*/,
					serializer: (response) => {
						serializerCalls.push(response);
						return "serialized";
					},
				},
			],
			defaultContentType: "text/plain",
		}),
	);

	const event = { headers: {} };
	let thrown;
	try {
		await handler(event, { ...defaultContext });
	} catch (e) {
		thrown = e;
	}

	// onError must early-return because request.response is undefined: the
	// serializer must never run, and the original error must propagate.
	strictEqual(thrown.message, "boom");
	strictEqual(serializerCalls.length, 0);
});

test("onError serializes a defined error response", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("boom");
	});

	// Serializer is added first so its onError runs AFTER the responder's
	// onError (onError stack runs in reverse order of addition). The responder
	// sets a defined response without a Content-Type so the serializer's
	// onError path actually serializes rather than early-returning.
	handler.use(
		httpResponseSerializer({
			serializers: [
				{
					regex: /^text\/plain$/,
					serializer: ({ body }) => `wrapped:${body}`,
				},
			],
			defaultContentType: "text/plain",
		}),
	);
	handler.use({
		onError: (request) => {
			request.response = { statusCode: 500, body: "Internal Error" };
			request.error = null;
		},
	});

	const event = { headers: {} };
	const response = await handler(event, { ...defaultContext });

	// The serializer's onError must NOT early-return (response is defined): it
	// serializes the body using the text/plain serializer.
	deepStrictEqual(response, {
		statusCode: 500,
		body: "wrapped:Internal Error",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});
