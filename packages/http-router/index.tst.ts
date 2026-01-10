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
import { expect } from "tstyche";
import httpRouterHandler from "./index.js";

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
