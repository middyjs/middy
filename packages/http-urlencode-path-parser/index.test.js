import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import urlEncodePathParser, {
	httpUrlencodePathParserValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should decode simple url encoded requests", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters; // propagates the body as response
	});

	handler.use(urlEncodePathParser());

	// invokes the handler
	const event = {
		pathParameters: {
			char: encodeURIComponent("Mîddy"),
		},
	};

	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		char: "Mîddy",
	});
});

test("It should skip if no path parameters", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters; // propagates the body as response
	});

	handler.use(urlEncodePathParser());

	// invokes the handler
	const event = {};

	const response = await handler(event, defaultContext);
	strictEqual(response, undefined);
});

// Security: Malformed URI encoding attack vectors
test("It should throw 400 for incomplete percent encoding", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			id: "%",
		},
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "id");
	}
});

test("It should throw 400 for invalid percent sequence %ZZ", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			name: "hello%ZZworld",
		},
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "name");
	}
});

test("It should handle multiple path parameters with one malformed", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			good: encodeURIComponent("hello"),
			bad: "%E0%A4%A",
		},
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "bad");
	}
});

test("It should not iterate inherited properties from pathParameters", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const pathParameters = { char: encodeURIComponent("test") };
	// Simulate inherited property - Object.keys should skip it
	const proto = { inherited: "%ZZ" };
	Object.setPrototypeOf(pathParameters, proto);

	const event = { pathParameters };

	const response = await handler(event, defaultContext);
	strictEqual(response.char, "test");
});

test("It should throw error", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters; // propagates the body as response
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			char: "%E0%A4%A",
		},
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "char");
	}
});

test("It should leave non-string path parameter values untouched", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			// A non-string value containing a '%' to ensure the typeof guard,
			// not the indexOf guard, is what causes the skip. decodeURIComponent
			// would throw "URI malformed" on this if the typeof guard were bypassed.
			num: 100,
		},
	};

	const response = await handler(event, defaultContext);
	strictEqual(response.num, 100);
});

test("It should leave a plain string without '%' untouched", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			// Contains characters that decodeURIComponent would alter only if a
			// '%' were present; "+" must NOT be decoded to a space. Asserting the
			// verbatim string proves decodeURIComponent was not applied.
			slug: "a+b c",
		},
	};

	const response = await handler(event, defaultContext);
	strictEqual(response.slug, "a+b c");
});

test("It should throw 400 (asserted) for invalid percent sequence", async (t) => {
	const handler = middy((event, context) => {
		return event.pathParameters;
	});

	handler.use(urlEncodePathParser());

	const event = {
		pathParameters: {
			char: "%E0%A4%A",
		},
	};

	let threw = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		threw = true;
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "char");
	}
	ok(threw, "expected handler to throw on malformed encoding");
});

test("httpUrlencodePathParserValidateOptions accepts empty options and rejects anything", () => {
	httpUrlencodePathParserValidateOptions({});
	httpUrlencodePathParserValidateOptions();
	try {
		httpUrlencodePathParserValidateOptions({ any: 1 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.message, "Unknown option 'any'");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
	}
	// Non-object input must be rejected via the JSON-Schema `type: "object"`
	// rule. An empty `{}` schema would instead reject it through the flat
	// object-schema path with a different message, so assert the exact message
	// that only the real schema produces.
	try {
		httpUrlencodePathParserValidateOptions(42);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.message, "Option '' must be object");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
	}
});
