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
import { expectType } from "tsd";
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
expectType<middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>>(
	middleware,
);

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
expectType<
	middy.MiddyfiedHandler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
>(middlewareV2);

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

expectType<middy.MiddyfiedHandler<ALBEvent, ALBResult>>(middlewareALB);

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

expectType<middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult>>(
	middlewareRouteNotFound,
);
