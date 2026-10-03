import middy from "@middy/core";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
	Handler as LambdaHandler,
} from "aws-lambda";
import { expect, test } from "tstyche";
import type { RouteContext } from "./index.js";
import * as indexModule from "./index.js";
import wsRouterHandler, {
	type RouteHandler,
	type RouterHandler,
} from "./index.js";

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
	RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
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
	RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
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
	RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
>();

// `Route.handler` has one call signature, so an inline arrow gets `event` and
// `context` from context, and a synchronous handler may return its result.
test("inline handler: event and context are contextually typed", () => {
	const router = wsRouterHandler([
		{
			routeKey: "$connect",
			handler: async (event, context) => {
				expect(event).type.toBe<APIGatewayProxyWebsocketEventV2>();
				expect(context).type.toBe<RouteContext>();
				return { statusCode: 200 };
			},
		},
		{
			routeKey: "$default",
			handler: (event) => ({ statusCode: 200, body: event.body }),
		},
	]);
	expect(router).type.toBe<
		RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
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
		RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
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

test("the router is a plain handler that middy() wraps", () => {
	const router = wsRouterHandler([
		{ routeKey: "$connect", handler: async () => ({ statusCode: 200 }) },
	]);
	expect(router).type.not.toHaveProperty("use");
	expect(middy(router)).type.toBe<
		middy.MiddyfiedHandler<
			APIGatewayProxyWebsocketEventV2,
			APIGatewayProxyResultV2
		>
	>();
});

test("the router is assignable to the aws-lambda Handler type", () => {
	const router = wsRouterHandler([
		{ routeKey: "$connect", handler: async () => ({ statusCode: 200 }) },
	]);
	expect(router).type.toBeAssignableTo<
		LambdaHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>
	>();
});

test("wsRouterValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.wsRouterValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("route handler context carries middyContext", () => {
	wsRouterHandler([
		{
			routeKey: "$connect",
			handler: async (_event, context) => {
				expect(context.middyContext).type.toBe<Record<string, unknown>>();
				return { statusCode: 200 };
			},
		},
	]);
});

test("rejects misspelled option", () => {
	expect(wsRouterHandler).type.not.toBeCallableWith({
		routes: [],
		notFoundResponce: () => ({}),
	});
});
