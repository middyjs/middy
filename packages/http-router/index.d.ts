// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Context,
} from "aws-lambda";

export type Method =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "OPTIONS"
	| "HEAD"
	| "ANY";

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy. A union of `Handler | MiddyfiedHandler` gave an
// inline `handler: (event, context) => ...` no contextual type (their parameter
// lists differ), so `event` was an implicit `any`. The rest parameter absorbs
// Lambda's `callback` and middy's `opts`; the router itself passes neither.
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: Context,
	...rest: any[]
	// biome-ignore lint/suspicious/noConfusingVoidType: Lambda's `Handler` returns `void | Promise<TResult>`, and `undefined` would refuse it
) => void | TResult | Promise<TResult>;

export interface Route<TEvent, TResult> {
	method: Method;
	path: string;
	handler: RouteHandler<TEvent, TResult>;
}

export type RouteNotFoundResponseFn = (input: {
	method: string;
	path: string;
}) => unknown;

// TODO v8: returns a plain handler fn, not MiddyfiedHandler (breaking type fix)
declare function httpRouterHandler<
	TEvent extends
		| ALBEvent
		| APIGatewayProxyEvent
		| APIGatewayProxyEventV2 = APIGatewayProxyEvent,
	TResult extends
		| ALBResult
		| APIGatewayProxyResult
		| APIGatewayProxyResultV2 = APIGatewayProxyResult,
>(
	routes:
		| Array<Route<TEvent, TResult>>
		| {
				routes: Array<Route<TEvent, TResult>>;
				notFoundResponse?: RouteNotFoundResponseFn;
		  },
): middy.MiddyfiedHandler<TEvent, TResult>;

export declare function httpRouterValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpRouterHandler;
