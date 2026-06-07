import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import wsRouter, { wsRouterValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Types of routes
test("It should route to a static route", async (t) => {
	const event = {
		requestContext: {
			routeKey: "$connect",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should throw 404 when route not found", async (t) => {
	const event = {
		requestContext: {
			routeKey: "missing",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	let threw = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		threw = true;
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
		deepStrictEqual(e.cause.data, { routeKey: "missing" });
	}
	ok(threw, "expected notFoundResponse to throw");
});

test("It should throw 404 when no routes are configured (default routes)", async (t) => {
	const event = {
		requestContext: {
			routeKey: "$connect",
		},
	};
	const handler = wsRouter();
	let threw = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		threw = true;
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(e.statusCode, 404);
		deepStrictEqual(e.cause.data, { routeKey: "$connect" });
	}
	ok(threw, "expected default empty routes to yield not found");
});

test("It should throw200 when route not found, using notFoundResponse", async (t) => {
	const event = {
		requestContext: {
			routeKey: "missing",
		},
	};
	const handler = wsRouter({
		routes: [
			{
				routeKey: "$connect",
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
	deepStrictEqual(JSON.parse(res.body), { routeKey: "missing" });
});

// with middleware
test("It should run middleware that are part of route handler", async (t) => {
	const event = {
		requestContext: {
			routeKey: "$connect",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: middy(() => false).after((request) => {
				request.response = true;
			}),
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should middleware part of router", async (t) => {
	const event = {
		requestContext: {
			routeKey: "$connect",
		},
	};
	const handler = middy(
		wsRouter([
			{
				routeKey: "$connect",
				handler: () => false,
			},
		]),
	).after((request) => {
		request.response = true;
	});
	const response = await handler(event, defaultContext);
	ok(response);
});

// Security: Prototype pollution via routeKey
test("It should not match inherited properties like __proto__ as routes", async (t) => {
	const event = {
		requestContext: {
			routeKey: "__proto__",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		// Should hit "not found" rather than matching an inherited property
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(e.statusCode, 404);
		strictEqual(e.message, "Route does not exist");
	}
});

test("It should not match inherited properties like constructor as routes", async (t) => {
	const event = {
		requestContext: {
			routeKey: "constructor",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		// Should hit "not found", not invoke Object.prototype.constructor
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(e.statusCode, 404);
		strictEqual(e.message, "Route does not exist");
	}
});

test("It should not match inherited properties like toString as routes", async (t) => {
	const event = {
		requestContext: {
			routeKey: "toString",
		},
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(e.statusCode, 404);
		strictEqual(e.message, "Route does not exist");
	}
});

// Errors

test("It should throw when not a ws event", async (t) => {
	const event = {
		path: "/",
	};
	const handler = wsRouter([
		{
			routeKey: "$connect",
			handler: () => true,
		},
	]);
	let threw = false;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		threw = true;
		strictEqual(e.cause.package, "@middy/ws-router");
		strictEqual(
			e.message,
			"Unknown WebSocket event format: missing 'requestContext.routeKey'",
		);
		deepStrictEqual(e.cause.data, { routeKey: undefined });
		ok("routeKey" in e.cause.data);
	}
	ok(threw, "expected missing routeKey to throw");
});

test("wsRouterValidateOptions accepts valid options and rejects typos", () => {
	wsRouterValidateOptions({ routes: [], notFoundResponse: () => {} });
	wsRouterValidateOptions({});
	try {
		wsRouterValidateOptions({ rotes: [] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/ws-router");
	}
});

test("wsRouterValidateOptions rejects wrong type", () => {
	try {
		wsRouterValidateOptions({ routes: "not-an-array" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("routes"));
	}
});

test("wsRouterValidateOptions rejects route missing required fields", () => {
	// Missing `handler`
	try {
		wsRouterValidateOptions({
			routes: [{ routeKey: "$connect" }],
		});
		ok(false, "expected throw for missing handler");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("handler"));
		strictEqual(e.cause.package, "@middy/ws-router");
	}
	// Missing `routeKey`
	try {
		wsRouterValidateOptions({
			routes: [{ handler: () => {} }],
		});
		ok(false, "expected throw for missing routeKey");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("routeKey"));
		strictEqual(e.cause.package, "@middy/ws-router");
	}
});

test("wsRouterValidateOptions rejects route with additional properties", () => {
	try {
		wsRouterValidateOptions({
			routes: [{ routeKey: "$connect", handler: () => {}, extra: true }],
		});
		ok(false, "expected throw for additional property");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("extra") || e.message.includes("additional"));
		strictEqual(e.cause.package, "@middy/ws-router");
	}
});

test("wsRouterValidateOptions rejects duplicate routeKey", () => {
	try {
		wsRouterValidateOptions({
			routes: [
				{ routeKey: "$connect", handler: () => {} },
				{ routeKey: "$connect", handler: () => {} },
			],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("routes[1]"));
		strictEqual(e.cause.package, "@middy/ws-router");
	}
});
