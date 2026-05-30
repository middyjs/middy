import {
	deepStrictEqual,
	match,
	ok,
	rejects,
	strictEqual,
} from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import jsonBodyParser, { wsJsonBodyParserValidateOptions } from "./index.js";

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
		body: '{ "foo" :   "bar"   }',
	};

	const processedEvent = await handler(event, defaultContext);

	deepStrictEqual(processedEvent.body, { foo: "bar" });
});

test("It should use a reviver when parsing a JSON request", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});
	const reviver = (_) => _;
	handler.use(jsonBodyParser({ reviver }));

	// invokes the handler
	const jsonString = JSON.stringify({ foo: "bar" });
	const event = {
		body: jsonString,
	};
	const jsonParseSpy = t.mock.method(JSON, "parse");

	await handler(event, defaultContext);

	deepStrictEqual(jsonParseSpy.mock.calls[0].arguments, [jsonString, reviver]);
});

test("It should handle invalid JSON as an UnprocessableEntity", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler
	const event = {
		body: `make it broken${JSON.stringify({ foo: "bar" })}`,
	};

	await rejects(handler(event, defaultContext), (e) => {
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.statusCode, 422);
		strictEqual(e.cause.package, "@middy/ws-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
		return true;
	});
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
		isBase64Encoded: true,
		body: base64Data,
	};

	await rejects(handler(event, defaultContext), (e) => {
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.statusCode, 422);
		strictEqual(e.cause.package, "@middy/ws-json-body-parser");
		match(e.cause.message, /^Unexpected token/);
		return true;
	});
});

test("It should handle missing body as an UnprocessableEntity", async (t) => {
	const handler = middy((event) => {
		return event.body; // propagates the body as a response
	});

	handler.use(jsonBodyParser());

	// invokes the handler with no body
	const event = {};

	await rejects(handler(event, defaultContext), (e) => {
		strictEqual(e.message, "Invalid or malformed JSON was provided");
		strictEqual(e.statusCode, 422);
		strictEqual(e.cause.package, "@middy/ws-json-body-parser");
		strictEqual(e.cause.data, undefined);
		// The missing-body guard throws directly (no JSON.parse), so the cause
		// carries no parser `message`. A body that reached JSON.parse would.
		ok(!("message" in e.cause));
		return true;
	});
});

test("wsJsonBodyParserValidateOptions accepts valid options and rejects typos", () => {
	wsJsonBodyParserValidateOptions({ reviver: (_k, v) => v });
	wsJsonBodyParserValidateOptions({});
	try {
		wsJsonBodyParserValidateOptions({ revivr: (_k, v) => v });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/ws-json-body-parser");
	}
});

test("wsJsonBodyParserValidateOptions rejects wrong type", () => {
	try {
		wsJsonBodyParserValidateOptions({ reviver: "not-a-fn" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("reviver"));
	}
});
