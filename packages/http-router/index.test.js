import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpRouter, { httpRouterValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Types of routes
test("It should route to a static route", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a static route with trailing slash", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic route with `{variable}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}/",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { id: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});
test("It should route to a dynamic route with `{variable1}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id1}/",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { id1: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});
test("It should route to a dynamic route with `{Variable}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{Id}/",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { Id: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});
test("It should route to a dynamic route with `{var_iable}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{i_d}/",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { i_d: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});
test("It should not route to a dynamic route with `{var-iable}`", async (t) => {
	try {
		httpRouter([
			{
				method: "GET",
				path: "/user/{i-d}/",
				handler: (event) => {
					deepStrictEqual(event.pathParameters, { "i-d": "1" });
					return true;
				},
			},
		]);
	} catch (e) {
		strictEqual(
			e.message,
			"Invalid regular expression: /^/user/(?<i-d>[^/]+)/?$/: Invalid capture group name",
		);
	}
});

test("It should route to a dynamic route with `{variable}` with trailing slash", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic route with multiple `{variable}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1/transactions/50",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { id: "1", transactions: "50" });
				return true;
			},
		},
		{
			method: "GET",
			path: "/user/{id}/transactions/{transactionId}",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic route (/) with `{proxy+}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/any",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/{proxy+}",
			handler: () => {
				deepStrictEqual(event.pathParameters, { proxy: "any" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic route (/path) with `{proxy+}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/path",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/path/{proxy+}",
			handler: () => {
				deepStrictEqual(event.pathParameters, { proxy: "" });
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic route (/path/to) with `{proxy+}`", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/path/to",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/path/{proxy+}",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { proxy: "to" });
				ok(!!event.pathParameters.__proto__);
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should not match a sibling segment against a parent `{proxy+}` route", async (t) => {
	let proxyCalled = false;
	const handler = httpRouter([
		{
			method: "GET",
			path: "/path/{proxy+}",
			handler: () => {
				proxyCalled = true;
				return true;
			},
		},
	]);
	// `/pathology` is a SIBLING of `/path`, not a child under `/path/`, so a
	// greedy `{proxy+}` must not capture across the segment boundary (AWS routes
	// `/path/{proxy+}` to `/path/bar`, never to `/pathology`).
	const event = { httpMethod: "GET", path: "/pathology" };
	try {
		await handler(event, defaultContext);
		ok(false, "expected 404: a sibling segment must not match {proxy+}");
	} catch (e) {
		strictEqual(e.statusCode, 404);
	}
	strictEqual(proxyCalled, false);
});

test("It should populate pathParameters to a dynamic route even if they already exist in the event", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/123",
		pathParameters: {
			previous: "321",
		},
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: (event) => {
				deepStrictEqual(event.pathParameters, { id: "123", previous: "321" });
				ok(!!event.pathParameters.__proto__);
				return true;
			},
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should throw 404 when route not found", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/notfound",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should throw200 when route not found, using notFoundResponse", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/notfound",
	};
	const handler = httpRouter({
		routes: [
			{
				method: "GET",
				path: "/",
				handler: () => true,
			},
		],
		notFoundResponse: (args) => {
			return {
				statusCode: 200,
				body: JSON.stringify(args),
			};
		},
	});

	const res = await handler(event, defaultContext);

	strictEqual(res.statusCode, 200);
	deepStrictEqual(JSON.parse(res.body), { method: "GET", path: "/notfound" });
});

// route methods
test("It should route to a static POST method", async (t) => {
	const event = {
		httpMethod: "POST",
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "POST",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a static ANY method", async (t) => {
	const event = {
		httpMethod: "POST",
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "ANY",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic POST method", async (t) => {
	const event = {
		httpMethod: "POST",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "POST",
			path: "/user/{id}",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a dynamic ANY method", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/1",
	};
	const handler = httpRouter([
		{
			method: "ANY",
			path: "/user/{id}",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

// event versions
test("It should route to a REST v1 event", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a v2 event", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "GET",
				path: "/",
			},
		},
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a VPC Lattice event", async (t) => {
	const event = {
		method: "GET",
		raw_path: "/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should route to a VPC Lattice event with query parameters", async (t) => {
	const event = {
		method: "GET",
		raw_path: "/path?key=value",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/path",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

// with middleware
test("It should run middleware that are part of route handler", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: middy(() => false).after((request) => {
				request.response = true;
			}),
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should not run middleware that are part of another route handler", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/",
	};
	let success = true;
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: middy(() => true),
		},
		{
			method: "GET",
			path: "/middy",
			handler: middy(() => false).before((request) => {
				success = false;
			}),
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
	ok(success);
});

test("It should run middleware part of router", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/",
	};
	const handler = middy(
		httpRouter([
			{
				method: "GET",
				path: "/",
				handler: () => false,
			},
		]),
	).after((request) => {
		request.response = true;
	});
	const response = await handler(event, defaultContext);
	ok(response);
});

// Errors
test("It should throw when unknown method is used", async (t) => {
	try {
		httpRouter([
			{
				method: "ALL",
				path: "/",
				handler: () => true,
			},
		]);
	} catch (e) {
		strictEqual(e.message, "Method not allowed");
	}
});

test("It should throw when not a http event (missing method)", async (t) => {
	const event = {
		path: "/",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
		);
	}
});

test("It should throw when not a http event (missing path)", async (t) => {
	const event = {
		httpMethod: "GET",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing path. Expected 'path' (v1), 'requestContext.http.path' (v2), or 'raw_path' (VPC)",
		);
	}
});

test("It should throw a descriptive error for an unknown event version", async (t) => {
	const event = {
		version: "3.0",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof TypeError));
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
		);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("It should throw a descriptive error for a malformed v2 event (missing requestContext.http)", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {},
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof TypeError));
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
		);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("It should throw a descriptive error for a malformed VPC Lattice event (missing raw_path)", async (t) => {
	const event = {
		method: "GET",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof TypeError));
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing path. Expected 'path' (v1), 'requestContext.http.path' (v2), or 'raw_path' (VPC)",
		);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("It should not invoke an Object.prototype member as a static handler", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "__proto__",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should throw 404 when method has no routes defined", async (t) => {
	const event = {
		httpMethod: "POST",
		path: "/any-path",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should throw 404 when method has only static routes and no matching dynamic route", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/user/123",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/",
			handler: () => true,
		},
		{
			method: "GET",
			path: "/about",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should return 404 when dynamic route exists but path does not match", async (t) => {
	const event = {
		httpMethod: "GET",
		path: "/different/123",
	};
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
		fail("Should have thrown 404");
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should escape regex metacharacters in static path segments", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/api/v1.0/{id}",
			handler: (event) => event.pathParameters.id,
		},
	]);

	// Should match literal dot
	const match = await handler(
		{ httpMethod: "GET", path: "/api/v1.0/123" },
		defaultContext,
	);
	strictEqual(match, "123");

	// Should NOT match non-dot character where dot is
	try {
		await handler({ httpMethod: "GET", path: "/api/v1X0/123" }, defaultContext);
		fail("Should have thrown 404");
	} catch (e) {
		strictEqual(e.statusCode, 404);
	}
});

// Behavior pinning tests — these lock in semantics so optimizations
// cannot silently regress matching order, parameter capture, or 404 paths.

test("It should route to the matching dynamic route when multiple segment counts coexist", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: (event) => `one:${event.pathParameters.id}`,
		},
		{
			method: "GET",
			path: "/user/{id}/posts/{postId}",
			handler: (event) =>
				`two:${event.pathParameters.id}-${event.pathParameters.postId}`,
		},
		{
			method: "GET",
			path: "/user/{id}/posts/{postId}/comments/{commentId}",
			handler: (event) =>
				`three:${event.pathParameters.id}-${event.pathParameters.postId}-${event.pathParameters.commentId}`,
		},
	]);

	strictEqual(
		await handler({ httpMethod: "GET", path: "/user/42" }, defaultContext),
		"one:42",
	);
	strictEqual(
		await handler(
			{ httpMethod: "GET", path: "/user/42/posts/9" },
			defaultContext,
		),
		"two:42-9",
	);
	strictEqual(
		await handler(
			{ httpMethod: "GET", path: "/user/42/posts/9/comments/7" },
			defaultContext,
		),
		"three:42-9-7",
	);
});

test("It should 404 a deeper path against a shallower dynamic route", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/user/{id}", handler: () => "should-not-match" },
	]);
	try {
		await handler(
			{ httpMethod: "GET", path: "/user/42/extra" },
			defaultContext,
		);
		ok(false, "expected 404");
	} catch (e) {
		strictEqual(e.statusCode, 404);
	}
});

test("It should 404 a shallower path against a deeper dynamic route", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}/posts/{postId}",
			handler: () => "should-not-match",
		},
	]);
	try {
		await handler({ httpMethod: "GET", path: "/user/42" }, defaultContext);
		ok(false, "expected 404");
	} catch (e) {
		strictEqual(e.statusCode, 404);
	}
});

test("It should preserve registration order: wildcard before specific wins", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/{proxy+}", handler: () => "wild" },
		{ method: "GET", path: "/users/{id}", handler: () => "specific" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/users/1" }, defaultContext),
		"wild",
	);
});

test("It should preserve registration order: specific before wildcard wins", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/users/{id}", handler: () => "specific" },
		{ method: "GET", path: "/{proxy+}", handler: () => "wild" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/users/1" }, defaultContext),
		"specific",
	);
	// Wildcard still catches non-matching depth
	strictEqual(
		await handler(
			{ httpMethod: "GET", path: "/users/1/extra/2" },
			defaultContext,
		),
		"wild",
	);
});

test("It should match wildcard across varying depths in a single router", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/files/{proxy+}",
			handler: (event) => event.pathParameters.proxy,
		},
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/files" }, defaultContext),
		"",
	);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/files/a" }, defaultContext),
		"a",
	);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/files/a/b/c" }, defaultContext),
		"a/b/c",
	);
});

test("It should isolate dynamic routes between methods", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/user/{id}", handler: () => "get" },
		{ method: "POST", path: "/user/{id}/items", handler: () => "post" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/user/1" }, defaultContext),
		"get",
	);
	try {
		await handler({ httpMethod: "POST", path: "/user/1" }, defaultContext);
		ok(false, "expected 404");
	} catch (e) {
		strictEqual(e.statusCode, 404);
	}
	strictEqual(
		await handler(
			{ httpMethod: "POST", path: "/user/1/items" },
			defaultContext,
		),
		"post",
	);
});

test("It should match dynamic route with trailing slash on the request", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/user/{id}",
			handler: (event) => event.pathParameters.id,
		},
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/user/42/" }, defaultContext),
		"42",
	);
});

test("It should route VPC Lattice event with empty query string", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/path", handler: () => true },
	]);
	ok(await handler({ method: "GET", raw_path: "/path?" }, defaultContext));
});

test("It should route VPC Lattice event with multiple query parameters", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/path", handler: () => true },
	]);
	ok(
		await handler(
			{ method: "GET", raw_path: "/path?a=1&b=2&c=3" },
			defaultContext,
		),
	);
});

test("It should expose a plain-object pathParameters (not null-prototype)", async (t) => {
	const handler = httpRouter([
		{
			method: "GET",
			path: "/u/{id}",
			handler: (event) => {
				ok(event.pathParameters.__proto__ === Object.prototype);
				return event.pathParameters.id;
			},
		},
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/u/9" }, defaultContext),
		"9",
	);
});

test("httpRouterValidateOptions accepts valid options and rejects typos", () => {
	httpRouterValidateOptions({ routes: [], notFoundResponse: () => {} });
	httpRouterValidateOptions({});
	try {
		httpRouterValidateOptions({ rotes: [] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("httpRouterValidateOptions rejects wrong type", () => {
	try {
		httpRouterValidateOptions({ routes: "not-an-array" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("routes"));
	}
});

test("httpRouterValidateOptions throws on duplicate static route", () => {
	try {
		httpRouterValidateOptions({
			routes: [
				{ method: "GET", path: "/a", handler: () => {} },
				{ method: "GET", path: "/a", handler: () => {} },
			],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("routes[1]"));
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("httpRouterValidateOptions allows distinct routes", () => {
	httpRouterValidateOptions({
		routes: [
			{ method: "GET", path: "/a", handler: () => {} },
			{ method: "POST", path: "/a", handler: () => {} },
			{ method: "GET", path: "/b", handler: () => {} },
			{ method: "GET", path: "/users/{id}", handler: () => {} },
			{ method: "GET", path: "/users/{id}/posts", handler: () => {} },
		],
	});
});

// Default routes table (index.js:13)
test("It should 404 when constructed with no routes option", async (t) => {
	const handler = httpRouter({});
	try {
		await handler({ httpMethod: "GET", path: "/" }, defaultContext);
		ok(false, "expected 404");
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

// 404 error cause shape (index.js:15-16)
test("It should attach cause package and data to the 404 error", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => true },
	]);
	try {
		await handler({ httpMethod: "POST", path: "/missing" }, defaultContext);
		ok(false, "expected 404");
	} catch (e) {
		ok(e.cause, "cause present");
		strictEqual(e.cause.package, "@middy/http-router");
		deepStrictEqual(e.cause.data, { method: "POST", path: "/missing" });
	}
});

// Supported methods list (index.js:22)
for (const method of [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
	"HEAD",
]) {
	test(`It should accept and route the ${method} method`, async (t) => {
		const handler = httpRouter([
			{ method, path: "/thing", handler: () => method },
		]);
		strictEqual(
			await handler({ httpMethod: method, path: "/thing" }, defaultContext),
			method,
		);
	});
}

// Option schema: required fields (index.js:32)
test("httpRouterValidateOptions rejects a route missing method", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ path: "/a", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("httpRouterValidateOptions rejects a route missing path", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "GET", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("httpRouterValidateOptions rejects a route missing handler", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "GET", path: "/a" }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

// Option schema: method enum includes ANY (index.js:34)
test("httpRouterValidateOptions accepts method ANY in the enum", () => {
	httpRouterValidateOptions({
		routes: [{ method: "ANY", path: "/a", handler: () => {} }],
	});
});

test("httpRouterValidateOptions rejects an unknown method in the enum", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "ALL", path: "/a", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

// Option schema: path leading-slash constraint (index.js:36-37)
test("httpRouterValidateOptions rejects a path without a leading slash", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "GET", path: "users", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

// Option schema: path trailing-slash constraint (index.js:36,38)
test("httpRouterValidateOptions rejects a path with a trailing slash", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "GET", path: "/users/", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

test("httpRouterValidateOptions accepts the root path /", () => {
	httpRouterValidateOptions({
		routes: [{ method: "GET", path: "/", handler: () => {} }],
	});
});

// Option schema: additionalProperties on a route (index.js:44)
test("httpRouterValidateOptions rejects unknown properties on a route", () => {
	try {
		httpRouterValidateOptions({
			routes: [{ method: "GET", path: "/a", handler: () => {}, extra: true }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

// Invalid-method guard at construction (index.js:70-72)
test("It should attach cause package and data to the method-not-allowed error", async (t) => {
	try {
		httpRouter([{ method: "ALL", path: "/", handler: () => true }]);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "Method not allowed");
		ok(e.cause, "cause present");
		strictEqual(e.cause.package, "@middy/http-router");
		deepStrictEqual(e.cause.data, { method: "ALL" });
	}
});

// Root path is not over-trimmed (index.js:77)
test("It should route the root / path exactly (not over-trimmed)", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => "root" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/" }, defaultContext),
		"root",
	);
	// The root "/" route must NOT have its slash trimmed to "" during
	// registration; if it were, the optional-trailing-slash key would become
	// "/" and the original "/" key "" so the request "//" (root + optional
	// slash) would 404. Real code keeps "/" and "//".
	strictEqual(
		await handler({ httpMethod: "GET", path: "//" }, defaultContext),
		"root",
	);
});

// Static vs dynamic dispatch (index.js:82)
test("It should dispatch a brace-free path via the static table (precedence over earlier wildcard)", async (t) => {
	// A wildcard dynamic route is registered FIRST, then a static route. Static
	// lookups happen before the dynamic loop, so the static route must win even
	// though the wildcard was registered earlier. If the static branch were
	// disabled, "/about" would be registered as a dynamic route and the
	// earlier "/{proxy+}" would capture the request instead.
	const handler = httpRouter([
		{ method: "GET", path: "/{proxy+}", handler: () => "wild" },
		{ method: "GET", path: "/about", handler: () => "static" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/about" }, defaultContext),
		"static",
	);
});

// Missing-method error cause (index.js:99)
test("It should attach cause data to the missing-method error", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => true },
	]);
	try {
		await handler({ path: "/" }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(e.cause, "cause present");
		ok(Object.hasOwn(e.cause.data, "method"));
		strictEqual(e.cause.data.method, undefined);
	}
});

// Missing-path error cause (index.js:107)
test("It should attach cause data to the missing-path error", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => true },
	]);
	try {
		await handler({ httpMethod: "GET" }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(e.cause, "cause present");
		ok(Object.hasOwn(e.cause.data, "path"));
		strictEqual(e.cause.data.path, undefined);
	}
});

// Wildcard $ anchor: {proxy+} must be terminal (index.js:156)
test("It should treat a non-terminal {proxy+} as a literal param and throw on construction", async (t) => {
	try {
		httpRouter([
			{ method: "GET", path: "/files/{proxy+}/x", handler: () => true },
		]);
		ok(false, "expected throw on invalid capture group name");
	} catch (e) {
		ok(
			e.message.includes("Invalid capture group name"),
			`unexpected message: ${e.message}`,
		);
	}
});

// {proxy+} depth marker vs fixed-depth dynamic (index.js:189)
test("It should not treat a non-proxy dynamic route as unbounded depth", async (t) => {
	// /a/{x} has fixed depth 2; a 3-segment request must 404, while the
	// 2-segment request matches. If segmentCount were forced to -1 the route
	// would behave like a wildcard for the regex... but regex still constrains.
	// Distinguish via a sibling deeper route that should win at depth 3.
	const handler = httpRouter([
		{ method: "GET", path: "/a/{x}", handler: () => "two" },
		{ method: "GET", path: "/a/{x}/{y}", handler: () => "three" },
	]);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/a/1" }, defaultContext),
		"two",
	);
	strictEqual(
		await handler({ httpMethod: "GET", path: "/a/1/2" }, defaultContext),
		"three",
	);
});

// v2 optional chaining for method (index.js:207)
test("It should safely extract method from a v2 event missing requestContext", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => true },
	]);
	try {
		await handler({ version: "2.0" }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof TypeError));
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
		);
	}
});

// v2 optional chaining for path (index.js:208)
test("It should safely extract path from a v2 event with method but missing requestContext.http", async (t) => {
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => true },
	]);
	// requestContext present but http missing -> method undefined too; to hit
	// the path branch we provide method via http but only check path safety.
	// Use a v2 event where requestContext is entirely absent: both optional
	// chains must short-circuit without a TypeError.
	try {
		await handler({ version: "2.0", requestContext: null }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(!(e instanceof TypeError));
		strictEqual(e.cause.package, "@middy/http-router");
	}
});

// VPC raw_path query strip at index 0 (index.js:215)
test("It should strip a VPC raw_path that is entirely a query string", async (t) => {
	// raw_path "?x=1" has "?" at index 0. With `q < 0` (real) the path becomes
	// "" -> falsy -> "missing path" error. The mutant `q <= 0` would NOT strip
	// and pass "?x=1" through, yielding a 404 "Route does not exist" instead.
	const handler = httpRouter([
		{ method: "GET", path: "/", handler: () => "root" },
	]);
	try {
		await handler({ method: "GET", raw_path: "?x=1" }, defaultContext);
		ok(false, "expected missing-path error for empty stripped path");
	} catch (e) {
		strictEqual(
			e.message,
			"Unknown HTTP event format: missing path. Expected 'path' (v1), 'requestContext.http.path' (v2), or 'raw_path' (VPC)",
		);
	}
});
