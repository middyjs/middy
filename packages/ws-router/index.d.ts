// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy, including a synchronous handler that returns its
// result (Lambda's `Handler` only allows `void | Promise`). The rest parameter
// absorbs Lambda's `callback` and middy's `opts`; the router passes neither.
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: Context,
	...rest: any[]
	// biome-ignore lint/suspicious/noConfusingVoidType: Lambda's `Handler` returns `void | Promise<TResult>`, and `undefined` would refuse it
) => void | TResult | Promise<TResult>;

export interface Route<TResult = never> {
	routeKey: string;
	handler: RouteHandler<
		APIGatewayProxyWebsocketEventV2,
		APIGatewayProxyResultV2<TResult>
	>;
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

export declare function wsRouterValidateOptions(
	options?: Record<string, unknown>,
): void;

export default wsRouterHandler;
