import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpHeaderNormalizer, {
	httpHeaderNormalizerValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Headers
test("It should normalize (lowercase) all the headers", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	const event = {
		headers: {
			"x-aPi-key": "123456",
			tcn: "abc",
			te: "cde",
			DNS: "d",
			FOO: "bar",
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"x-api-key": "123456",
		tcn: "abc",
		te: "cde",
		dns: "d",
		foo: "bar",
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.headers, expectedHeaders);
});

test("It should normalize (canonical) all the headers", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ canonical: true }));

	const event = {
		headers: {
			"x-api-key": "123456",
			tcn: "abc",
			te: "cde",
			DNS: "d",
			FOO: "bar",
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"X-Api-Key": "123456",
		TCN: "abc",
		TE: "cde",
		Dns: "d",
		Foo: "bar",
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.headers, expectedHeaders);
});

test("It can use custom normalization function", async (t) => {
	const normalizeHeaderKey = (key) => key.toUpperCase();

	const handler = middy((event, context) => event);

	handler.use(
		httpHeaderNormalizer({
			normalizeHeaderKey,
		}),
	);

	const event = {
		headers: {
			"x-api-key": "123456",
			tcn: "abc",
			te: "cde",
			DNS: "d",
			FOO: "bar",
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"X-API-KEY": "123456",
		TCN: "abc",
		TE: "cde",
		DNS: "d",
		FOO: "bar",
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.headers, expectedHeaders);
});

test("It should normalize (lowercase) all the headers with defaults", async (t) => {
	const handler = middy()
		.use(
			httpHeaderNormalizer({
				defaultHeaders: {
					"Content-Type": "application/json",
					Accept: "application/json,*/*",
				},
			}),
		)
		.handler((event, context) => event);

	const event = {
		headers: {
			"x-aPi-key": "123456",
			tcn: "abc",
			te: "cde",
			DNS: "d",
			FOO: "bar",
			Accept: "application/json",
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"x-api-key": "123456",
		tcn: "abc",
		te: "cde",
		dns: "d",
		foo: "bar",
		accept: "application/json",
		"content-type": "application/json",
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.headers, expectedHeaders);
});

// multiValueHeaders

test("It should normalize (lowercase) all the multiValueHeaders", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	const event = {
		multiValueHeaders: {
			cOOkie: ["123456", "654321"],
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		cookie: ["123456", "654321"],
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.multiValueHeaders, expectedHeaders);
});

test("It should normalize (canonical) all the multiValueHeaders", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ canonical: true }));

	const event = {
		multiValueHeaders: {
			cOOkie: ["123456", "654321"],
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		Cookie: ["123456", "654321"],
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.multiValueHeaders, expectedHeaders);
});

test("It can use custom normalization function on multiValueHeaders", async (t) => {
	const normalizeHeaderKey = (key) => key.toUpperCase();

	const handler = middy((event, context) => event);

	handler.use(
		httpHeaderNormalizer({
			normalizeHeaderKey,
		}),
	);

	const event = {
		multiValueHeaders: {
			cOOkie: ["123456", "654321"],
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		COOKIE: ["123456", "654321"],
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.multiValueHeaders, expectedHeaders);
});

test("It should normalize (lowercase) all the multiValueHeaders with defaults", async (t) => {
	const handler = middy()
		.use(
			httpHeaderNormalizer({
				defaultHeaders: {
					"Content-Type": "application/json,*/*",
					Accept: ["application/json", "*/*"],
				},
			}),
		)
		.handler((event, context) => event);

	const event = {
		multiValueHeaders: {
			"x-aPi-key": ["123456"],
			tcn: ["abc"],
			te: ["cde"],
			DNS: ["d"],
			FOO: ["bar"],
			Accept: ["application/json"],
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"x-api-key": ["123456"],
		tcn: ["abc"],
		te: ["cde"],
		dns: ["d"],
		foo: ["bar"],
		accept: ["application/json"],
		"content-type": ["application/json", "*/*"],
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.multiValueHeaders, expectedHeaders);
});

// Misc
test("It should not fail if the event does not contain headers", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({}));

	const event = {
		foo: "bar",
	};

	const expectedEvent = {
		foo: "bar",
	};

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent, expectedEvent);
});

// Security: Prototype property collision in canonical exceptions lookup
test("It should not match inherited properties like 'constructor' in canonical exceptions", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ canonical: true }));

	const event = {
		headers: {
			constructor: "some-value",
		},
	};

	const resultingEvent = await handler(event, defaultContext);

	// "constructor" should be canonicalized normally (to "Constructor"),
	// NOT matched against Object.prototype.constructor
	deepStrictEqual(
		resultingEvent.headers,
		Object.assign(Object.create(null), {
			Constructor: "some-value",
		}),
	);
});

test("It should not match inherited properties like 'toString' in canonical exceptions", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ canonical: true }));

	const event = {
		headers: {
			tostring: "some-value",
		},
	};

	const resultingEvent = await handler(event, defaultContext);

	// "tostring" should be canonicalized normally (to "Tostring"),
	// NOT matched against Object.prototype.toString
	deepStrictEqual(
		resultingEvent.headers,
		Object.assign(Object.create(null), {
			Tostring: "some-value",
		}),
	);
});

test("It should keep a literal __proto__ header as an own property without altering the prototype", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	const headers = JSON.parse('{"__proto__":"polluted","foo":"bar"}');
	const event = { headers };

	const resultingEvent = await handler(event, defaultContext);

	// The prototype must be untouched (the value must not become the prototype).
	strictEqual(Object.getPrototypeOf(resultingEvent.headers), null);
	// __proto__ must survive as an own enumerable property and not be dropped.
	ok(Object.hasOwn(resultingEvent.headers, "__proto__"));
	ok(Object.keys(resultingEvent.headers).includes("__proto__"));
	strictEqual(resultingEvent.headers.foo, "bar");
	// The header value survives intact.
	strictEqual(
		Object.getOwnPropertyDescriptor(resultingEvent.headers, "__proto__").value,
		"polluted",
	);
});

test("It should keep a literal __proto__ multiValueHeaders header as an own property without altering the prototype", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	// Build an event whose multiValueHeaders object genuinely has an own
	const multiValueHeaders = JSON.parse(
		'{"__proto__":["polluted"],"foo":["bar"]}',
	);
	const event = { multiValueHeaders };

	const resultingEvent = await handler(event, defaultContext);

	// The prototype must be untouched (the value must not replace the prototype).
	strictEqual(Object.getPrototypeOf(resultingEvent.multiValueHeaders), null);
	ok(Object.hasOwn(resultingEvent.multiValueHeaders, "__proto__"));
	ok(Object.keys(resultingEvent.multiValueHeaders).includes("__proto__"));
	deepStrictEqual(
		Object.getOwnPropertyDescriptor(
			resultingEvent.multiValueHeaders,
			"__proto__",
		).value,
		["polluted"],
	);
	deepStrictEqual(resultingEvent.multiValueHeaders.foo, ["bar"]);
});

test("It should not fail given a corrupted header key", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ canonical: true }));

	const event = {
		headers: {
			"X----": "foo",
		},
	};

	const expectedHeaders = Object.assign(Object.create(null), {
		"X----": "foo",
	});

	const resultingEvent = await handler(event, defaultContext);

	deepStrictEqual(resultingEvent.headers, expectedHeaders);
});

// Canonical exception list: each entry must be preserved with its exact casing
const canonicalExceptions = [
	"ALPN",
	"C-PEP",
	"C-PEP-Info",
	"CalDAV-Timezones",
	"Content-ID",
	"Content-MD5",
	"DASL",
	"DAV",
	"DNT",
	"ETag",
	"GetProfile",
	"HTTP2-Settings",
	"Last-Event-ID",
	"MIME-Version",
	"NEL",
	"Optional-WWW-Authenticate",
	"Sec-WebSocket-Accept",
	"Sec-WebSocket-Extensions",
	"Sec-WebSocket-Key",
	"Sec-WebSocket-Protocol",
	"Sec-WebSocket-Version",
	"SLUG",
	"TCN",
	"TE",
	"TTL",
	"WWW-Authenticate",
	"X-ATT-DeviceId",
	"X-DNSPrefetch-Control",
	"X-UIDH",
];

for (const exception of canonicalExceptions) {
	test(`It should preserve canonical exception casing for "${exception}"`, async (t) => {
		const handler = middy((event, context) => event);

		handler.use(httpHeaderNormalizer({ canonical: true }));

		const event = {
			headers: {
				[exception.toLowerCase()]: "value",
			},
		};

		const resultingEvent = await handler(event, defaultContext);

		deepStrictEqual(
			resultingEvent.headers,
			Object.assign(Object.create(null), {
				[exception]: "value",
			}),
		);
	});
}

test("It should reuse the normalized key cache for repeated header keys", async (t) => {
	let calls = 0;
	const normalizeHeaderKey = (key) => {
		calls += 1;
		return key.toUpperCase();
	};

	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer({ normalizeHeaderKey }));

	const event1 = {
		headers: {
			"x-api-key": "123456",
		},
	};
	const event2 = {
		headers: {
			"x-api-key": "abcdef",
		},
	};

	const result1 = await handler(event1, defaultContext);
	const result2 = await handler(event2, defaultContext);

	deepStrictEqual(
		result1.headers,
		Object.assign(Object.create(null), { "X-API-KEY": "123456" }),
	);
	deepStrictEqual(
		result2.headers,
		Object.assign(Object.create(null), { "X-API-KEY": "abcdef" }),
	);
	// The key "x-api-key" should be normalized only once; the second event
	// hits the cache. If the cache-hit branch were skipped, calls would be 2.
	strictEqual(calls, 1);
});

test("It should join array-valued defaultHeaders with a comma for single-value headers", async (t) => {
	const handler = middy()
		.use(
			httpHeaderNormalizer({
				defaultHeaders: {
					foo: ["a", "b"],
				},
			}),
		)
		.handler((event, context) => event);

	const event = {
		headers: {
			bar: "baz",
		},
	};

	const resultingEvent = await handler(event, defaultContext);

	strictEqual(resultingEvent.headers.foo, "a,b");
});

test("It should not merge any defaults into headers when defaultHeaders is empty", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	const event = {
		headers: {
			FOO: "bar",
		},
	};

	const resultingEvent = await handler(event, defaultContext);

	// Only the request's own normalized header should be present, no defaults.
	deepStrictEqual(
		resultingEvent.headers,
		Object.assign(Object.create(null), {
			foo: "bar",
		}),
	);
	strictEqual(Object.keys(resultingEvent.headers).length, 1);
});

test("It should not merge any defaults into multiValueHeaders when defaultHeaders is empty", async (t) => {
	const handler = middy((event, context) => event);

	handler.use(httpHeaderNormalizer());

	const event = {
		multiValueHeaders: {
			FOO: ["bar"],
		},
	};

	const resultingEvent = await handler(event, defaultContext);

	// Only the request's own normalized key should be present, no defaults.
	deepStrictEqual(
		resultingEvent.multiValueHeaders,
		Object.assign(Object.create(null), {
			foo: ["bar"],
		}),
	);
	strictEqual(Object.keys(resultingEvent.multiValueHeaders).length, 1);
});

test("httpHeaderNormalizerValidateOptions accepts valid options and rejects typos", () => {
	httpHeaderNormalizerValidateOptions({
		canonical: true,
		defaultHeaders: { X: "y", Accept: ["application/json", "*/*"] },
		normalizeHeaderKey: (k) => k,
	});
	httpHeaderNormalizerValidateOptions({});
	try {
		httpHeaderNormalizerValidateOptions({ canonial: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-header-normalizer");
	}
});

test("httpHeaderNormalizerValidateOptions rejects wrong type", () => {
	try {
		httpHeaderNormalizerValidateOptions({ canonical: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("canonical"));
	}
});

test("httpHeaderNormalizerValidateOptions rejects non-string defaultHeaders values", () => {
	try {
		httpHeaderNormalizerValidateOptions({ defaultHeaders: { X: 42 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("defaultHeaders.X"));
	}
	try {
		httpHeaderNormalizerValidateOptions({
			defaultHeaders: { X: ["ok", 42] },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("defaultHeaders.X"));
	}
});
