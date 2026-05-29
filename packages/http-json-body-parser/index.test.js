import { deepStrictEqual, match, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import jsonBodyParser, { httpJsonBodyParserValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should parse a JSON request", async (t) => {
	const handler = middy((event) => {
		return event; // propagates the processed event as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: '{ "foo" :   "bar"   }',
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(processedEvent.body, { foo: "bar" });
});

test("It should parse a JSON with a suffix MediaType request", async (t) => {
	const handler = middy((event) => {
		return event; // propagates the processed event as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/vnd+json",
		},
		body: '{ "foo" :   "bar"   }',
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(processedEvent.body, { foo: "bar" });
});

test("It should use a reviver when parsing a JSON request", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});
	const reviver = t.mock.fn((_key, value) =>
		typeof value === "string" ? value.toUpperCase() : value,
	);
	handler.use(jsonBodyParser({ reviver }));

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);

	ok(reviver.mock.callCount() >= 1);
	deepStrictEqual(body, { foo: "BAR" });
});

test("It should parse a JSON request with lowercase header", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);

	deepStrictEqual(body, { foo: "bar" });
});

test("It should handle invalid JSON as an UnprocessableEntity", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: `make it broken${JSON.stringify({ foo: "bar" })}`,
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
	}
});

test("It should handle undefined as an UnprocessableEntity", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: undefined,
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		strictEqual(e.cause.data, undefined);
	}
});

test("It shouldn't process the body if no header is passed", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser({ disableContentTypeError: true }));

	// invokes the handler
	const event = {
		headers: {},
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);

	strictEqual(body, '{"foo":"bar"}');
});

test("It shouldn't process the body and throw error if no header is passed", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser({ disableContentTypeError: false }));

	// invokes the handler
	const event = {
		headers: {},
		body: JSON.stringify({ foo: "bar" }),
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 415);
		strictEqual(e.message, "Unsupported Media Type");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		strictEqual(e.cause.data, undefined);
	}
});

test("It should handle undefined body if no header", async (t) => {
	/**
	 * test checks that if the body is undefined, no content-type header is passed and disableContentTypeError is true,
	 * the handler should process the request and do not throw an error
	 */
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser({ disableContentTypeError: true }));

	// invokes the handler
	const event = {
		headers: {},
		body: undefined,
	};

	const body = await handler(event, defaultContext);
	strictEqual(body, undefined);
});

test("It should handle a base64 body", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const data = JSON.stringify({ foo: "bar" });
	const base64Data = Buffer.from(data).toString("base64");
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		isBase64Encoded: true,
		body: base64Data,
	};

	const body = await handler(event, defaultContext);

	deepStrictEqual(body, { foo: "bar" });
});

test("It should handle invalid base64 JSON as an UnprocessableEntity", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const data = `make it broken${JSON.stringify({ foo: "bar" })}`;
	const base64Data = Buffer.from(data).toString("base64");
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		isBase64Encoded: true,
		body: base64Data,
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
	}
});

test("It should not retain a dangerous own __proto__ on the parsed body", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: '{ "__proto__": { "polluted": true }, "foo": "bar" }',
	};

	const body = await handler(event, defaultContext);

	// The own `__proto__` data property must be dropped so downstream
	// consumers that copy keys cannot have their prototype mutated.
	strictEqual(Object.hasOwn(body, "__proto__"), false);
	strictEqual(body.foo, "bar");

	// Simulate a downstream consumer copying keys onto a fresh object.
	const target = {};
	for (const key in body) {
		target[key] = body[key];
	}
	strictEqual(Object.getPrototypeOf(target), Object.prototype);
	strictEqual(target.polluted, undefined);
});

test("httpJsonBodyParserValidateOptions accepts valid options and rejects typos", () => {
	httpJsonBodyParserValidateOptions({
		reviver: (_k, v) => v,
		disableContentTypeCheck: true,
	});
	httpJsonBodyParserValidateOptions({});
	try {
		httpJsonBodyParserValidateOptions({ disableContentTpyeCheck: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
	}
});

test("httpJsonBodyParserValidateOptions rejects wrong type", () => {
	try {
		httpJsonBodyParserValidateOptions({ reviver: "not-a-fn" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("reviver"));
	}
});
