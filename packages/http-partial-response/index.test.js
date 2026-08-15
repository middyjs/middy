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

test("It should pass through a non-JSON body untouched even with the filter param", async (t) => {
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

	deepStrictEqual(response, {
		statusCode: 200,
		body: "response",
	});
});

test("It should pass through a bare-string response untouched even with the filter param", async (t) => {
	const handler = middy(() => "response");

	handler.use(httpPartialResponse());

	const event = {
		headers: {},
		queryStringParameters: {
			fields: "firstname",
		},
	};

	const response = await handler(event, defaultContext);

	strictEqual(response, "response");
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

test("It should not throw when request.event is undefined", async (t) => {
	const { after } = httpPartialResponse();
	const request = {
		event: undefined,
		response: { statusCode: 200, body: { firstname: "john" } },
	};
	after(request);
	deepStrictEqual(request.response.body, { firstname: "john" });
});

test("It should not throw when request.response is undefined but fields present", async (t) => {
	const { after } = httpPartialResponse();
	const request = {
		event: { queryStringParameters: { fields: "firstname" } },
		response: undefined,
	};
	after(request);
	strictEqual(request.response, undefined);
});

test("It should leave the body unchanged when fields query param is absent", async (t) => {
	const { after } = httpPartialResponse();
	const body = { firstname: "john", lastname: "doe" };
	const request = {
		event: { queryStringParameters: {} },
		response: { statusCode: 200, body },
	};
	after(request);
	strictEqual(request.response.body, body);
	deepStrictEqual(request.response, { statusCode: 200, body });
});

test("It should not throw and return the response unchanged for a deeply nested fields selector", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	// Deeply nested selector "a/a/.../a" that would overflow the V8 call
	// stack inside json-mask and bubble a RangeError out of the after phase.
	const nested = new Array(9000).fill("a").join("/");
	const event = {
		headers: {},
		queryStringParameters: {
			fields: nested,
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, {
		firstname: "john",
		lastname: "doe",
	});
});

test("It should not throw and return the response unchanged for an over-length flat fields selector", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	// Huge flat comma list that exceeds the length cap.
	const flat = new Array(5000).fill("a").join(",");
	const event = {
		headers: {},
		queryStringParameters: {
			fields: flat,
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, {
		firstname: "john",
		lastname: "doe",
	});
});

test("It should return the response unchanged when fields nesting depth exceeds the cap", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	// Short overall, but nesting depth (count of "/") is above the cap.
	const deep = new Array(150).fill("a").join("/");
	const event = {
		headers: {},
		queryStringParameters: {
			fields: deep,
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, {
		firstname: "john",
		lastname: "doe",
	});
});

test("It should return the response unchanged when fields grouping depth exceeds the cap", async (t) => {
	const handler = middy(() => createDefaultObjectResponse());

	handler.use(httpPartialResponse());

	// Short overall, but grouping depth (count of "(") is above the cap.
	const grouped = `${new Array(150).fill("a(").join("")}b${new Array(150)
		.fill(")")
		.join("")}`;
	const event = {
		headers: {},
		queryStringParameters: {
			fields: grouped,
		},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response.body, {
		firstname: "john",
		lastname: "doe",
	});
});

test("It should return the response unchanged when mask throws", async (t) => {
	const { after } = httpPartialResponse();
	// An object body whose selected property throws when json-mask reads it,
	// forcing mask() itself to throw and exercising the try/catch safety net.
	const body = {
		get firstname() {
			throw new Error("boom");
		},
	};
	const request = {
		event: { queryStringParameters: { fields: "firstname" } },
		response: { statusCode: 200, body },
	};
	after(request);
	strictEqual(request.response.body, body);
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
