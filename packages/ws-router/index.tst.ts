import middy from "@middy/core";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
	Context,
} from "aws-lambda";
import { expect, test } from "tstyche";
import wsRouterHandler, { type RouteHandler } from "./index.js";

const connectLambdaHandler: APIGatewayProxyWebsocketHandlerV2 = async () => {
	return {
		statusCode: 200,
		body: "Connected to websocket",
	};
};

const disconnectLambdaHandler: APIGatewayProxyWebsocketHandlerV2 = async () => {
	return {
		statusCode: 200,
		body: "Disconnected to websocket",
	};
};

const middleware = wsRouterHandler([
	{
		routeKey: "$connect",
		handler: connectLambdaHandler,
	},
	{
		routeKey: "$disconnect",
		handler: disconnectLambdaHandler,
	},
]);
expect(middleware).type.toBe<
	middy.MiddyfiedHandler<
		APIGatewayProxyWebsocketEventV2,
		APIGatewayProxyResultV2
	>
>();

const middlewareWithOptions = wsRouterHandler({
	routes: [
		{
			routeKey: "$connect",
			handler: connectLambdaHandler,
		},
		{
			routeKey: "$disconnect",
			handler: disconnectLambdaHandler,
		},
	],
	notFoundResponse: ({ routeKey }) => {
		throw new Error(`Route not found: ${routeKey}`);
	},
});
expect(middlewareWithOptions).type.toBe<
	middy.MiddyfiedHandler<
		APIGatewayProxyWebsocketEventV2,
		APIGatewayProxyResultV2
	>
>();

const middlewareWithReturnResponse = wsRouterHandler({
	routes: [
		{
			routeKey: "$connect",
			handler: connectLambdaHandler,
		},
	],
	notFoundResponse: ({ routeKey }) => ({ statusCode: 404, body: routeKey }),
});
expect(middlewareWithReturnResponse).type.toBe<
	middy.MiddyfiedHandler<
		APIGatewayProxyWebsocketEventV2,
		APIGatewayProxyResultV2
	>
>();

// `Route.handler` has one call signature, so an inline arrow gets `event` and
// `context` from context, and a synchronous handler may return its result.
test("inline handler: event and context are contextually typed", () => {
	const router = wsRouterHandler([
		{
			routeKey: "$connect",
			handler: async (event, context) => {
				expect(event).type.toBe<APIGatewayProxyWebsocketEventV2>();
				expect(context).type.toBe<Context>();
				return { statusCode: 200 };
			},
		},
		{
			routeKey: "$default",
			handler: (event) => ({ statusCode: 200, body: event.body }),
		},
	]);
	expect(router).type.toBe<
		middy.MiddyfiedHandler<
			APIGatewayProxyWebsocketEventV2,
			APIGatewayProxyResultV2
		>
	>();
});

test("middyfied handler as a route handler", () => {
	const connectHandler = middy<
		APIGatewayProxyWebsocketEventV2,
		APIGatewayProxyResultV2
	>().handler(async () => ({ statusCode: 200 }));
	const router = wsRouterHandler([
		{
			routeKey: "$connect",
			handler: connectHandler,
		},
	]);
	expect(router).type.toBe<
		middy.MiddyfiedHandler<
			APIGatewayProxyWebsocketEventV2,
			APIGatewayProxyResultV2
		>
	>();
});

test("RouteHandler type", () => {
	expect(connectLambdaHandler).type.toBeAssignableTo<
		RouteHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
	>();
	expect(
		middy<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>(),
	).type.toBeAssignableTo<
		RouteHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
	>();
});
