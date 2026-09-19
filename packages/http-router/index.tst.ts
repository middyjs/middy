import middy from "@middy/core";
import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Context,
	Handler as LambdaHandler,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpRouterHandler, {
	type Method,
	type Route,
	type RouteHandler,
	type RouteNotFoundResponseFn,
} from "./index.js";

const lambdaHandler: LambdaHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = async (event) => {
	return {
		statusCode: 200,
		body: "Hello world",
	};
};

const middleware = httpRouterHandler([
	{
		method: "GET",
		path: "/",
		handler: lambdaHandler,
	},
]);
expect(middleware).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
>();

const lambdaHandlerV2: LambdaHandler<
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2
> = async (event) => {
	return {
		statusCode: 200,
		body: "Hello world",
	};
};

const middlewareV2 = httpRouterHandler([
	{
		method: "GET",
		path: "/",
		handler: lambdaHandlerV2,
	},
]);
expect(middlewareV2).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
>();

const lambdaHandlerALB: LambdaHandler<ALBEvent, ALBResult> = async (event) => {
	return {
		statusCode: 200,
		body: "Hello world",
	};
};

const middlewareALB = httpRouterHandler([
	{
		method: "GET",
		path: "/",
		handler: lambdaHandlerALB,
	},
]);

expect(middlewareALB).type.toBe<middy.MiddyfiedHandler<ALBEvent, ALBResult>>();

const middlewareRouteNotFound = httpRouterHandler({
	routes: [
		{
			method: "GET",
			path: "/",
			handler: lambdaHandler,
		},
	],
	notFoundResponse: ({ method, path }) => {
		throw new Error(`Route not found: ${method} ${path}`);
	},
});

expect(middlewareRouteNotFound).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
>();

const middlewareRouteNotFoundReturn = httpRouterHandler({
	routes: [
		{
			method: "GET",
			path: "/",
			handler: lambdaHandler,
		},
	],
	notFoundResponse: ({ method, path }) => ({
		statusCode: 404,
		body: `${method} ${path} not found`,
	}),
});

expect(middlewareRouteNotFoundReturn).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
>();

// notFoundResponse has a default in the implementation, so it must be optional
const middlewareRoutesOnly = httpRouterHandler({
	routes: [
		{
			method: "GET",
			path: "/",
			handler: lambdaHandler,
		},
	],
});

expect(middlewareRoutesOnly).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
>();

test("Method type", () => {
	const method: Method = "GET";
	expect(method).type.toBeAssignableTo<Method>();

	expect<string>().type.not.toBeAssignableTo<Method>();
});

test("Route interface", () => {
	const route: Route<APIGatewayProxyEvent, APIGatewayProxyResult> = {
		method: "GET",
		path: "/test",
		handler: lambdaHandler,
	};
	expect(route).type.toBeAssignableTo<
		Route<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
	expect(route.method).type.toBe<Method>();
	expect(route.path).type.toBe<string>();
});

test("RouteNotFoundResponseFn type", () => {
	const fn: RouteNotFoundResponseFn = ({ method, path }) => {
		throw new Error(`${method} ${path} not found`);
	};
	expect(fn).type.toBeAssignableTo<RouteNotFoundResponseFn>();

	const fnReturn: RouteNotFoundResponseFn = ({ method, path }) => ({
		statusCode: 404,
		body: `${method} ${path} not found`,
	});
	expect(fnReturn).type.toBeAssignableTo<RouteNotFoundResponseFn>();
});

// `Route.handler` has one call signature, so an inline arrow gets `event` and
// `context` from context instead of an implicit `any` (TS7006).
test("inline handler: event and context are contextually typed", () => {
	const router = httpRouterHandler([
		{
			method: "GET",
			path: "/",
			handler: async (event, context) => {
				expect(event).type.toBe<APIGatewayProxyEvent>();
				expect(context).type.toBe<Context>();
				return { statusCode: 200, body: "Hello world" };
			},
		},
		{
			method: "POST",
			path: "/",
			// A synchronous handler returning the result directly.
			handler: (event) => ({ statusCode: 201, body: event.body ?? "" }),
		},
	]);
	expect(router).type.toBeAssignableTo<
		middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
});

test("inline handler: explicit generics pick the event type", () => {
	const router = httpRouterHandler<
		APIGatewayProxyEventV2,
		APIGatewayProxyResultV2
	>([
		{
			method: "GET",
			path: "/",
			handler: (event, context) => {
				expect(event).type.toBe<APIGatewayProxyEventV2>();
				expect(context).type.toBe<Context>();
				return { statusCode: 200, body: "Hello world" };
			},
		},
	]);
	expect(router).type.toBe<
		middy.MiddyfiedHandler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
	>();
});

test("inline handler: a typed sibling route fixes the event type", () => {
	const router = httpRouterHandler([
		{
			method: "GET",
			path: "/",
			handler: lambdaHandlerALB,
		},
		{
			method: "POST",
			path: "/",
			handler: async (event) => {
				expect(event).type.toBe<ALBEvent>();
				return { statusCode: 200, body: "Hello world" };
			},
		},
	]);
	expect(router).type.toBe<middy.MiddyfiedHandler<ALBEvent, ALBResult>>();
});

test("middyfied handler as a route handler", () => {
	const getHandler = middy<
		APIGatewayProxyEvent,
		APIGatewayProxyResult
	>().handler(async (event) => ({ statusCode: 200, body: event.path }));
	const router = httpRouterHandler([
		{
			method: "GET",
			path: "/",
			handler: getHandler,
		},
	]);
	expect(router).type.toBe<
		middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
});

test("RouteHandler type", () => {
	expect(lambdaHandler).type.toBeAssignableTo<
		RouteHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
	expect(
		middy<APIGatewayProxyEvent, APIGatewayProxyResult>(),
	).type.toBeAssignableTo<
		RouteHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
	expect(
		(event: APIGatewayProxyEvent): APIGatewayProxyResult => ({
			statusCode: 200,
			body: event.path,
		}),
	).type.toBeAssignableTo<
		RouteHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
	// The event type is enforced, not just inferred.
	expect(lambdaHandlerV2).type.not.toBeAssignableTo<
		RouteHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
});
