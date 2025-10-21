import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpRouter from "./index.js";

// const event = {}
const context = {
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { id: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { id1: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { Id: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { i_d: "1" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
	ok(response);
});
test("It should not route to a dynamic route with `{var-iable}`", async (t) => {
	try {
		httpRouter([
			{
				method: "GET",
				path: "/user/{i-d}/",
				handler: (event) => {
					deepEqual(event.pathParameters, { "i-d": "1" });
					return true;
				},
			},
		]);
	} catch (e) {
		equal(
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
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { id: "1", transactions: "50" });
				return true;
			},
		},
		{
			method: "GET",
			path: "/user/{id}/transactions/{transactionId}",
			handler: () => true,
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { proxy: "any" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { proxy: "" });
				return true;
			},
		},
	]);
	const response = await handler(event, context);
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
				deepEqual(event.pathParameters, { proxy: "to" });
				ok(!!event.pathParameters.__proto__);
				return true;
			},
		},
	]);
	const response = await handler(event, context);
	ok(response);
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
				deepEqual(event.pathParameters, { id: "123", previous: "321" });
				ok(!!event.pathParameters.__proto__);
				return true;
			},
		},
	]);
	const response = await handler(event, context);
	ok(response);
});

test("It should thrown 404 when route not found", async (t) => {
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
		await handler(event, context);
	} catch (e) {
		equal(e.message, "Route does not exist");
		equal(e.statusCode, 404);
	}
});

test("It should thrown 200 when route not found, using notFoundResponse", async (t) => {
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

	const res = await handler(event, context);

	equal(res.statusCode, 200);
	deepEqual(JSON.parse(res.body), { method: "GET", path: "/notfound" });
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
		equal(e.message, "Method not allowed");
	}
});

test("It should throw when not a http event", async (t) => {
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
		await handler(event, context);
	} catch (e) {
		equal(e.message, "Unknown http event format");
	}
});
