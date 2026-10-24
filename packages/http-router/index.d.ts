// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Context,
	Handler,
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

// middy seeds `context.middyContext` on every invocation of the wrapping
// `middy()` handler, which the router forwards to the route handler.
export type RouteContext = Context & { middyContext: Record<string, unknown> };

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy. A union of `Handler | MiddyfiedHandler` gave an
// inline `handler: (event, context) => ...` no contextual type (their parameter
// lists differ), so `event` was an implicit `any`. The rest parameter takes the
// router's own third argument, which it forwards as is (middy's `{ signal }`
// when wrapped).
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: RouteContext,
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

// The router is a plain function, not a middyfied handler: wrap it with
// `middy()` to attach middleware. It returns whatever the matched route handler
// returns and forwards its third argument (middy's `{ signal }` when wrapped)
// to that handler untouched. It is also an aws-lambda `Handler`, so it can be
// exported as a Lambda handler or assigned to one directly.
export type RouterHandler<TEvent, TResult> = Handler<TEvent, TResult> &
	((
		event: TEvent,
		context: Context,
		...rest: any[]
	) => TResult | Promise<TResult>);

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
): RouterHandler<TEvent, TResult>;

export declare function httpRouterValidateOptions<TOptions extends object>(
	options?: TOptions,
): TOptions;

export default httpRouterHandler;
