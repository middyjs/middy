// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
	Handler,
} from "aws-lambda";

// middy seeds `context.middyContext` on every invocation of the wrapping
// `middy()` handler, which the router forwards to the route handler.
export type RouteContext = Context & { middyContext: Record<string, unknown> };

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy, including a synchronous handler that returns its
// result (Lambda's `Handler` only allows `void | Promise`). The rest parameter
// takes the router's own third argument, which it forwards as is (middy's
// `{ signal }` when wrapped).
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: RouteContext,
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

declare function wsRouterHandler(
	options: Options | Route[],
): RouterHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2>;

export declare function wsRouterValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default wsRouterHandler;
