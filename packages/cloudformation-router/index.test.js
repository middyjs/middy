import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import cloudformationRouter, {
	cloudformationRouterValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Types of routes
test("It should route to a static route", async (t) => {
	const event = {
		RequestType: "Create",
	};
	const handler = cloudformationRouter([
		{
			requestType: "Create",
			handler: () => true,
		},
	]);
	const response = await handler(event, defaultContext);
	ok(response);
});

test("It should throw FAILURE when route not found", async (t) => {
	const event = {
		RequestType: "Update",
	};
	const handler = cloudformationRouter([
		{
			requestType: "Create",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "Route does not exist");
	}
});

test("It should throw FAILURE when route not found, using notFoundResponse", async (t) => {
	const event = {
		RequestType: "Update",
	};
	const handler = cloudformationRouter({
		routes: [
			{
				requestType: "Create",
				handler: () => true,
			},
		],
		notFoundResponse: (args) => {
			return {
				Status: "SUCCESS",
			};
		},
	});
	const res = await handler(event, defaultContext);

	strictEqual(res.Status, "SUCCESS");
});

// with middleware
test("It should run middleware that are part of route handler", async (t) => {
	const event = {
		RequestType: "Create",
	};
	const handler = cloudformationRouter([
		{
			requestType: "Create",
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
		RequestType: "Create",
	};
	const handler = middy(
		cloudformationRouter([
			{
				requestType: "Create",
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

test("It should throw when not a cloudformation event", async (t) => {
	const event = {
		path: "/",
	};
	const handler = cloudformationRouter([
		{
			requestType: "Create",
			handler: () => true,
		},
	]);
	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(
			e.message,
			"Unknown CloudFormation Custom Resource event format: 'RequestType' must be one of Create, Update, Delete. Received: undefined",
		);
	}
});

test("cloudformationRouterValidateOptions accepts valid options and rejects typos", () => {
	cloudformationRouterValidateOptions({
		routes: [],
		notFoundResponse: () => {},
	});
	cloudformationRouterValidateOptions({});
	try {
		cloudformationRouterValidateOptions({ rotes: [] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/cloudformation-router");
	}
});

test("cloudformationRouterValidateOptions rejects wrong type", () => {
	try {
		cloudformationRouterValidateOptions({ routes: "not-an-array" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("routes"));
	}
});

test("cloudformationRouterValidateOptions rejects invalid requestType", () => {
	try {
		cloudformationRouterValidateOptions({
			routes: [{ requestType: "Patch", handler: () => {} }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/cloudformation-router");
	}
});

test("cloudformationRouterValidateOptions rejects non-function handler", () => {
	try {
		cloudformationRouterValidateOptions({
			routes: [{ requestType: "Create", handler: "not-a-fn" }],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("cloudformationRouterValidateOptions rejects duplicate requestType", () => {
	try {
		cloudformationRouterValidateOptions({
			routes: [
				{ requestType: "Create", handler: () => {} },
				{ requestType: "Create", handler: () => {} },
			],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("routes[1]"));
		strictEqual(e.cause.package, "@middy/cloudformation-router");
	}
});
