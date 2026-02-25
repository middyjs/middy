// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
} from "aws-lambda";

export interface Route<TResult = never> {
	routeKey: string;
	handler: APIGatewayProxyWebsocketHandlerV2<TResult>;
}

export type RouteNotFoundResponseFn = (input: { routeKey: string }) => unknown;

export interface Options {
	routes: Route[];
	notFoundResponse?: RouteNotFoundResponseFn;
}

declare function wsRouterHandler(
	options: Options | Route[],
): middy.MiddyfiedHandler<
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyResultV2
>;

export default wsRouterHandler;
