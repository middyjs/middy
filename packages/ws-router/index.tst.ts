import type middy from "@middy/core";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";
import { expect } from "tstyche";
import wsRouterHandler from "./index.js";

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
