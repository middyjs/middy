import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";
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

describe("@middy/http-partial-response", () => {
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

	// A selector the middleware refuses is the client's mistake, so it answers
	// 400 rather than quietly returning the whole body (or letting a TypeError
	// out as a 500).
	const expect400 = async (handler, fields, reason) => {
		try {
			await handler(
				{ headers: {}, queryStringParameters: { fields } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 400);
			strictEqual(e.cause.package, "@middy/http-partial-response");
			deepStrictEqual(e.cause.data, { reason });
		}
	};

	test("It should respond 400 for a deeply nested fields selector", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		// Deeply nested selector "a/a/.../a" that would overflow the V8 call
		// stack inside json-mask and bubble a RangeError out of the after phase.
		const nested = new Array(9000).fill("a").join("/");

		await expect400(handler, nested, "Selector exceeds 2048 characters");
	});

	test("It should respond 400 for an over-length flat fields selector", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		// Huge flat comma list that exceeds the length cap.
		const flat = new Array(5000).fill("a").join(",");

		await expect400(handler, flat, "Selector exceeds 2048 characters");
	});

	test("It should respond 400 when fields nesting depth exceeds the cap", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		// Short overall, but nesting depth (count of "/") is above the cap.
		const deep = new Array(150).fill("a").join("/");

		await expect400(handler, deep, "Selector exceeds a depth of 100");
	});

	test("It should respond 400 when fields grouping depth exceeds the cap", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		// Short overall, but grouping depth (count of "(") is above the cap.
		const grouped = `${new Array(150).fill("a(").join("")}b${new Array(150)
			.fill(")")
			.join("")}`;

		await expect400(handler, grouped, "Selector exceeds a depth of 100");
	});

	test("It should respond 400 when fields is neither a string nor an array of strings", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		await expect400(handler, 42, "Selector must be a string");
		await expect400(handler, { a: 1 }, "Selector must be a string");
		await expect400(handler, ["firstname", 42], "Selector must be a string");
	});

	// VPC Lattice V2 delivers every query string value as an array, one entry per
	// occurrence. The last occurrence wins, as it does for a repeated parameter
	// on the other event formats.
	test("It should filter by the last entry of an array selector", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		const response = await handler(
			{
				version: "2.0",
				method: "GET",
				headers: {},
				queryStringParameters: { fields: ["firstname", "lastname"] },
			},
			defaultContext,
		);

		deepStrictEqual(response.body, { lastname: "doe" });
	});

	test("It should treat an empty array selector as no selector", async (t) => {
		const handler = middy(() => createDefaultObjectResponse());

		handler.use(httpPartialResponse());

		const response = await handler(
			{ headers: {}, queryStringParameters: { fields: [] } },
			defaultContext,
		);

		deepStrictEqual(response.body, { firstname: "john", lastname: "doe" });
	});

	// A selector the middleware refuses is refused before the handler runs: the
	// 400 is the same whatever the handler would have done, and the work the
	// handler would have done is not done for a response that cannot be sent.
	const expect400BeforeHandler = async (fields, reason) => {
		let handlerRan = false;
		const handler = middy(() => {
			handlerRan = true;
			return createDefaultObjectResponse();
		});
		handler.use(httpPartialResponse());
		await expect400(handler, fields, reason);
		strictEqual(handlerRan, false);
	};

	test("It should refuse a non-string selector before the handler runs", async (t) => {
		await expect400BeforeHandler(42, "Selector must be a string");
	});

	test("It should refuse an over-length selector before the handler runs", async (t) => {
		await expect400BeforeHandler(
			new Array(5000).fill("a").join(","),
			"Selector exceeds 2048 characters",
		);
	});

	test("It should refuse an over-depth selector before the handler runs", async (t) => {
		await expect400BeforeHandler(
			new Array(150).fill("a").join("/"),
			"Selector exceeds a depth of 100",
		);
	});

	test("It should not run the selector checks in before when there is no selector", async (t) => {
		const { before } = httpPartialResponse();
		const request = { event: { queryStringParameters: {} } };
		strictEqual(before(request), undefined);
		strictEqual(before({ event: undefined }), undefined);
	});

	test("It should respond 400 when mask throws", async (t) => {
		const { after } = httpPartialResponse();
		// An object body whose selected property throws when json-mask reads it,
		// forcing mask() itself to throw.
		const body = {
			get firstname() {
				throw new Error("boom");
			},
		};
		const request = {
			event: { queryStringParameters: { fields: "firstname" } },
			response: { statusCode: 200, body },
		};
		try {
			after(request);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 400);
			strictEqual(e.cause.package, "@middy/http-partial-response");
			deepStrictEqual(e.cause.data, {
				reason: "Selector could not be applied",
			});
		}
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

	test("It should still filter a selector of exactly the maximum length", async (t) => {
		// The gate is `> 2048`, so exactly 2048 must pass; `>= 2048` would bail out
		// and return the response unfiltered.
		const handler = middy(() => createDefaultObjectResponse());
		handler.use(httpPartialResponse());

		const fields = "firstname".padEnd(2048, ",a");
		strictEqual(fields.length, 2048);

		const response = await handler(
			{ headers: {}, queryStringParameters: { fields } },
			defaultContext,
		);

		deepStrictEqual(response.body, { firstname: "john" });
	});

	test("It should still filter a selector at exactly the maximum depth", async (t) => {
		// The gate is `> 100`, so exactly 100 separators must pass; `>= 100` would
		// bail out and return the response unfiltered.
		const handler = middy(() => createDefaultObjectResponse());
		handler.use(httpPartialResponse());

		// 100 "(" characters, closed again, wrapped around a real field name.
		const open = "a(".repeat(100);
		const fields = `firstname,${open}b${")".repeat(100)}`;
		strictEqual((fields.match(/[/(]/g) ?? []).length, 100);

		const response = await handler(
			{ headers: {}, queryStringParameters: { fields } },
			defaultContext,
		);

		deepStrictEqual(response.body, { firstname: "john" });
	});

	test("It should only count separators toward the depth cap", async (t) => {
		// A long but flat selector has depth 0. Counting every character instead
		// (or inverting either comparison) pushes it past the cap and silently
		// disables filtering.
		const handler = middy(() => createDefaultObjectResponse());
		handler.use(httpPartialResponse());

		const fields = `firstname${",a".repeat(200)}`;
		ok(fields.length > 100);

		const response = await handler(
			{ headers: {}, queryStringParameters: { fields } },
			defaultContext,
		);

		deepStrictEqual(response.body, { firstname: "john" });
	});

	test("It should normalize a response that carries no statusCode or headers", async (t) => {
		// A bare body object must be normalized before the filtered body is written
		// back, otherwise the handler returns a response with no statusCode.
		const handler = middy(() => ({
			body: { firstname: "john", lastname: "doe" },
		}));
		handler.use(httpPartialResponse());

		const response = await handler(
			{ headers: {}, queryStringParameters: { fields: "firstname" } },
			defaultContext,
		);

		strictEqual(response.statusCode, 500);
		deepStrictEqual(response.headers, {});
		deepStrictEqual(response.body, { firstname: "john" });
	});
});
