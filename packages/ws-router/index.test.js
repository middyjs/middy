import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import wsRouter from "./index.js";

// const event = {}
const context = {
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
	const response = await handler(event, context);
	ok(response);
});

test("It should thrown 404 when route not found", async (t) => {
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
	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
		strictEqual(e.statusCode, 404);
	}
});

test("It should thrown 200 when route not found, using notFoundResponse", async (t) => {
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
	const res = await handler(event, context);

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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
	ok(response);
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
	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(e.message, "Unknown WebSocket event format");
	}
});
