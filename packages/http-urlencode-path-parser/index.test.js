import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import urlEncodePathParser from "./index.js";

// const event = {}
const context = {
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

	const response = await handler(event, context);
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

	const response = await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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

	const response = await handler(event, context);
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
		await handler(event, context);
	} catch (e) {
		strictEqual(e.statusCode, 400);
		strictEqual(e.message, "Invalid path parameter encoding");
		strictEqual(e.cause.package, "@middy/http-urlencode-path-parser");
		strictEqual(e.cause.data, "char");
	}
});
