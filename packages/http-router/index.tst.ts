import type middy from "@middy/core";
import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Handler as LambdaHandler,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpRouterHandler, {
	type Method,
	type Route,
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
