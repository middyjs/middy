// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

interface Route<T = never> {
	routeKey: string;
	handler: APIGatewayProxyWebsocketHandlerV2<T>;
}

export interface Options {
	routes: Route[];
	notFoundResponse?: (input: { routeKey: string }) => any;
}

declare function wsRouterHandler(
	options: Options | Route[],
): middy.MiddyfiedHandler;

export default wsRouterHandler;
