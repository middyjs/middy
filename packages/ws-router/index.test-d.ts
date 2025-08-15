import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
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
expect(middleware).type.toBe<middy.MiddyfiedHandler>();
