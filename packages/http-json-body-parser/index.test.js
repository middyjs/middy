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

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
	}
	ok(thrown, "expected handler to throw on invalid JSON");
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

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		strictEqual(e.cause.data, undefined);
	}
	ok(thrown, "expected handler to throw on undefined body");
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

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 415);
		strictEqual(e.message, "Unsupported Media Type");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		strictEqual(e.cause.data, undefined);
	}
	ok(thrown, "expected handler to throw 415 on missing content-type");
});

test("It should throw 415 by default when content-type is missing", async (t) => {
	// No options at all: the default `disableContentTypeError: false` must
	// cause a 415 to be thrown (kills the BooleanLiteral default mutant).
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser());

	const event = {
		headers: {},
		body: JSON.stringify({ foo: "bar" }),
	};

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 415);
		strictEqual(e.message, "Unsupported Media Type");
	}
	ok(thrown, "expected default options to throw 415");
});

test("It should return without parsing when content-type check disabled and error disabled", async (t) => {
	// disableContentTypeError true: the failing content-type branch must
	// `return` (not throw), leaving the body untouched. Kills the
	// ConditionalExpression mutant on the disableContentTypeError check.
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser({ disableContentTypeError: true }));

	const event = {
		headers: { "Content-Type": "text/plain" },
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);
	strictEqual(body, '{"foo":"bar"}');
});

test("It should not throw when headers is undefined and content-type error disabled", async (t) => {
	// headers is entirely absent: optional chaining on `headers?.[...]` must
	// guard against the lookup throwing. Kills the OptionalChaining mutants.
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser({ disableContentTypeError: true }));

	const event = {
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);
	strictEqual(body, '{"foo":"bar"}');
});

test("It should parse when content-type check is disabled", async (t) => {
	// disableContentTypeCheck true with a non-JSON content type: parsing must
	// still occur. Exercises the disableContentTypeCheck branch.
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser({ disableContentTypeCheck: true }));

	const event = {
		headers: { "Content-Type": "text/plain" },
		body: JSON.stringify({ foo: "bar" }),
	};

	const body = await handler(event, defaultContext);
	deepStrictEqual(body, { foo: "bar" });
});

test("It should throw 422 when body is undefined even if content-type check disabled", async (t) => {
	// disableContentTypeCheck true reaches the `typeof body === "undefined"`
	// guard, which must throw 422. Kills the ConditionalExpression / StringLiteral
	// / BlockStatement mutants on the body-undefined check.
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser({ disableContentTypeCheck: true }));

	const event = {
		headers: { "Content-Type": "application/json" },
		body: undefined,
	};

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		// The dedicated body-undefined guard reports the raw body and carries
		// NO parser `message`. If the guard is removed, control falls through to
		// JSON.parse(undefined) and the catch attaches a `cause.message`, so
		// asserting its absence kills the guard mutants.
		strictEqual(e.cause.data, undefined);
		strictEqual(e.cause.message, undefined);
	}
	ok(thrown, "expected 422 when body is undefined");
});

test("It should parse normally when body is a defined empty-object string", async (t) => {
	// A non-undefined body must NOT hit the body-undefined guard; it parses.
	// Helps distinguish the body-undefined ConditionalExpression mutant (repl=false
	// would skip the throw for undefined, repl=true would wrongly throw here).
	const handler = middy((event) => event.body);
	handler.use(jsonBodyParser());

	const event = {
		headers: { "Content-Type": "application/json" },
		body: "{}",
	};

	const body = await handler(event, defaultContext);
	deepStrictEqual(body, {});
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

	let thrown = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = true;
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
	}
	ok(thrown, "expected handler to throw on invalid base64 JSON");
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

test("httpJsonBodyParserValidateOptions rejects non-boolean disableContentTypeError", () => {
	// The optionSchema for disableContentTypeError must enforce `type: "boolean"`.
	// Kills the StringLiteral/ObjectLiteral schema mutants on that property.
	httpJsonBodyParserValidateOptions({ disableContentTypeError: true });
	let thrown = false;
	try {
		httpJsonBodyParserValidateOptions({ disableContentTypeError: "nope" });
	} catch (e) {
		thrown = true;
		ok(e instanceof TypeError);
		ok(e.message.includes("disableContentTypeError"));
		strictEqual(e.cause.package, "@middy/http-json-body-parser");
	}
	ok(thrown, "expected throw for non-boolean disableContentTypeError");
});
