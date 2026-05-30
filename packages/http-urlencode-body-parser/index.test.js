import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import urlEncodeBodyParser, {
	httpUrlencodeBodyParserValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should decode complex url encoded requests", async (t) => {
	const handler = middy((event, context) => {
		return event; // propagates the body as response
	});

	handler.use(urlEncodeBodyParser());

	// invokes the handler
	const body = "a[b][c][d]=i";
	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body,
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(
		processedEvent.body,
		Object.assign(Object.create(null), {
			"a[b][c][d]": "i",
		}),
	);
});

test("It should default when body is empty", async (t) => {
	const handler = middy((event) => {
		return event; // propagates the processed event as a response
	});

	handler.use(urlEncodeBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body: "",
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(processedEvent.body, Object.create(null));
});

test("It should default when body is undefined", async (t) => {
	const handler = middy((event) => {
		return event; // propagates the processed event as a response
	});

	handler.use(urlEncodeBodyParser());

	// invokes the handler
	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body: undefined,
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(processedEvent.body, Object.create(null));
});

test("It should not process the body if no headers are passed", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(urlEncodeBodyParser({ disableContentTypeError: true }));

	// invokes the handler
	const event = {
		headers: {},
		body: "a[b][c][d]=i",
	};

	const body = await handler(event, defaultContext);

	strictEqual(body, "a[b][c][d]=i");
});

test("It shouldn't process the body and throw error if no header is passed", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(urlEncodeBodyParser({ disableContentTypeError: false }));

	// invokes the handler
	const event = {
		headers: {},
		body: "a[b][c][d]=i",
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.statusCode, 415);
		strictEqual(e.message, "Unsupported Media Type");
		strictEqual(e.cause.package, "@middy/http-urlencode-body-parser");
		strictEqual(e.cause.data, undefined);
	}
});

test("It should leniently parse a single-field body (querystring.parse is total)", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(urlEncodeBodyParser());

	// `search` is a valid x-www-form-urlencoded field with an empty value. The
	// removed heuristic wrongly rejected this as malformed with a 422.
	const event = {
		body: "search",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
	};

	const body = await handler(event, defaultContext);
	strictEqual(body.search, "");
});

// Security: Prototype pollution via __proto__ key
test("It should not pollute prototype with __proto__ key in body", async (t) => {
	const handler = middy((event) => {
		return event.body;
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "__proto__[polluted]=true&foo=bar",
	};

	const body = await handler(event, defaultContext);

	// querystring.parse returns null-prototype object, so __proto__ is just a key, not a prototype setter
	strictEqual({}.polluted, undefined);
	strictEqual(Object.getPrototypeOf(body), null);
});

test("It should not pollute prototype with constructor key in body", async (t) => {
	const handler = middy((event) => {
		return event.body;
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "constructor=polluted",
	};

	const body = await handler(event, defaultContext);

	// Should not affect other objects' constructor
	strictEqual({}.constructor, Object);
	strictEqual(Object.getPrototypeOf(body), null);
});

test("It should decode duplicate keys into an array", async (t) => {
	const handler = middy((event) => {
		return event;
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body: "key=i&key=j",
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(
		processedEvent.body,
		Object.assign(Object.create(null), {
			key: ["i", "j"],
		}),
	);
});

test("It should handle mix of single and duplicate keys", async (t) => {
	const handler = middy((event) => {
		return event;
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "solo=one&multi=a&multi=b&another=two",
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(
		processedEvent.body,
		Object.assign(Object.create(null), {
			solo: "one",
			multi: ["a", "b"],
			another: "two",
		}),
	);
});

test("It should decode triple duplicate keys into an array", async (t) => {
	const handler = middy((event) => {
		return event;
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "a=1&a=2&a=3",
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(
		processedEvent.body,
		Object.assign(Object.create(null), {
			a: ["1", "2", "3"],
		}),
	);
});

test("It should handle base64 body", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
		},
		body: Buffer.from("a=a&b=b").toString("base64"),
		isBase64Encoded: true,
	};

	const body = await handler(event, defaultContext);

	deepStrictEqual(body, Object.assign(Object.create(null), { a: "a", b: "b" }));
});

test("It should reject a content-type with trailing junk after the type", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded-extra",
		},
		body: "a=1",
	};

	await handler(event, defaultContext).then(
		() => ok(false, "expected 415 to be thrown"),
		(e) => {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		},
	);
});

test("It should reject a content-type with a leading prefix before the type", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "text/application/x-www-form-urlencoded",
		},
		body: "a=1",
	};

	await handler(event, defaultContext).then(
		() => ok(false, "expected 415 to be thrown"),
		(e) => {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		},
	);
});

test("It should check content-type and throw 415 by default with no options", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: "a=1",
	};

	await handler(event, defaultContext).then(
		() => ok(false, "expected 415 to be thrown"),
		(e) => {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		},
	);
});

test("It should parse when content-type is provided via lowercase content-type key", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser());

	const event = {
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: "a=1",
	};

	const body = await handler(event, defaultContext);
	strictEqual(body.a, "1");
});

test("It should not throw when event has no headers object and check is disabled", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser({ disableContentTypeCheck: true }));

	const event = {
		body: "a=1",
	};

	const body = await handler(event, defaultContext);
	strictEqual(body.a, "1");
});

test("It should throw 415 when event has no headers object and check is enabled", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser());

	const event = {
		body: "a=1",
	};

	await handler(event, defaultContext).then(
		() => ok(false, "expected 415 to be thrown"),
		(e) => {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.data, undefined);
		},
	);
});

test("It should silently return on bad content-type when disableContentTypeError is true", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser({ disableContentTypeError: true }));

	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: "a=1",
	};

	const body = await handler(event, defaultContext);
	// Body is left untouched (not parsed) because the gate returned early.
	strictEqual(body, "a=1");
});

test("It should throw 415 on bad content-type when disableContentTypeError is false", async (t) => {
	const handler = middy((event) => event.body);
	handler.use(urlEncodeBodyParser({ disableContentTypeError: false }));

	const event = {
		headers: {
			"Content-Type": "application/json",
		},
		body: "a=1",
	};

	await handler(event, defaultContext).then(
		() => ok(false, "expected 415 to be thrown"),
		(e) => {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		},
	);
});

test("httpUrlencodeBodyParserValidateOptions accepts valid options and rejects typos", () => {
	httpUrlencodeBodyParserValidateOptions({
		disableContentTypeCheck: true,
		disableContentTypeError: false,
	});
	httpUrlencodeBodyParserValidateOptions({});
	try {
		httpUrlencodeBodyParserValidateOptions({ disableContentTpyeCheck: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-urlencode-body-parser");
	}
});

test("httpUrlencodeBodyParserValidateOptions rejects wrong type", () => {
	try {
		httpUrlencodeBodyParserValidateOptions({ disableContentTypeCheck: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("disableContentTypeCheck"));
	}
});
