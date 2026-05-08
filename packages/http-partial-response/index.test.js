import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpPartialResponse, {
	httpPartialResponseValidateOptions,
} from "./index.js";

const createDefaultObjectResponse = () =>
	Object.assign(
		{},
		{
			statusCode: 200,
			body: { firstname: "john", lastname: "doe" },
		},
	);

const createDefaultStringifiedResponse = () =>
	Object.assign(
		{},
		{
			statusCode: 200,
			body: JSON.stringify({
				firstname: "john",
				lastname: "doe",
			}),
		},
	);

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should filter a response with default opts (string)", async (t) => {
	const handler = middy(() => ({
		statusCode: 200,
		body: "response",
	}));

	handler.use(httpPartialResponse());

	const event = {
		headers: {},
		queryStringParameters: {
			fields: "firstname",
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, "response");
});

test("It should filter a response with default opts (object)", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	const event = {
		headers: {},
		queryStringParameters: {
			fields: "firstname",
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, { firstname: "john" });
});

test("It should filter a response with defined filter key name in opts", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse({ filteringKeyName: "filter" }));

	const event = {
		headers: {},
		queryStringParameters: {
			filter: "lastname",
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, { lastname: "doe" });
});

test("It should filter a stringified response with default opts", async (t) => {
	const handler = middy(() => createDefaultStringifiedResponse());

	handler.use(httpPartialResponse());

	const event = {
		headers: {},
		queryStringParameters: {
			fields: "firstname",
		},
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.body, JSON.stringify({ firstname: "john" }));
});

test("It should return the initial response if response body is empty", async (t) => {
	const handler = middy(() => "");

	handler.use(httpPartialResponse());

	const event = {
		headers: {},
	};
	const response = await handler(event, defaultContext);

	strictEqual(response, "");
});

test("It should return the initial response if response body is not an object neither a json string", async (t) => {
	const handler = middy(() => ({
		statusCode: 200,
		body: "success response",
	}));

	handler.use(httpPartialResponse());

	const response = await handler(defaultEvent, defaultContext);

	strictEqual(response.body, "success response");
});

test("It should return the initial response if there is no queryStringParameters filtering key", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response.body, {
		firstname: "john",
		lastname: "doe",
	});
});

test("httpPartialResponseValidateOptions accepts valid options and rejects typos", () => {
	httpPartialResponseValidateOptions({ filteringKeyName: "fields" });
	httpPartialResponseValidateOptions({});
	try {
		httpPartialResponseValidateOptions({ filteringKey: "x" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-partial-response");
	}
});

test("httpPartialResponseValidateOptions rejects wrong type", () => {
	try {
		httpPartialResponseValidateOptions({ filteringKeyName: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("filteringKeyName"));
	}
});
