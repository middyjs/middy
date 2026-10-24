// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	CloudFormationCustomResourceEvent,
	Context,
	Handler,
} from "aws-lambda";

// middy seeds `context.middyContext` on every invocation of the wrapping
// `middy()` handler, which the router forwards to the route handler.
export type RouteContext = Context & { middyContext: Record<string, unknown> };

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy, including a synchronous handler (Lambda's `Handler`
// only allows `void | Promise`). The rest parameter takes the router's own
// third argument, which it forwards as is (middy's `{ signal }` when wrapped).
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: RouteContext,
	...rest: any[]
	// biome-ignore lint/suspicious/noConfusingVoidType: Lambda's `Handler` returns `void | Promise<TResult>`, and `undefined` would refuse it
) => void | TResult | Promise<TResult>;

// `TResult` was previously forwarded to `CloudFormationCustomResourceHandler`,
// whose first parameter is the resource-properties type, so the default of
// `never` typed every route's `event.ResourceProperties` as `never`.
// `@middy/cloudformation-response` reads the custom resource response
// (`PhysicalResourceId`, `Data`, ...) from what the handler returns.
export interface Route<TResult = unknown> {
	requestType: "Create" | "Update" | "Delete";
	handler: RouteHandler<CloudFormationCustomResourceEvent, TResult>;
}

// The fields a handler may return for `@middy/cloudformation-response` to send;
// it fills `Status`, `RequestId`, `StackId`, `LogicalResourceId` and
// `PhysicalResourceId` from the request when absent.
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html
export interface CloudFormationRouteResponse {
	Status?: "SUCCESS" | "FAILED";
	Reason?: string;
	RequestId?: string;
	StackId?: string;
	LogicalResourceId?: string;
	PhysicalResourceId?: string;
	NoEcho?: boolean;
	Data?: Record<string, unknown>;
}

export type RouteNotFoundResponseFn = (input: {
	requestType: string;
}) => unknown;

export interface Options<TResult = unknown> {
	routes: Route<TResult>[];
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

// `NoInfer` checks every route against one `TResult` instead of inferring it
// from the first route, so a route returning a response and one returning
// nothing can share a router.
declare function cloudformationRouterHandler<
	// biome-ignore lint/suspicious/noConfusingVoidType: a route may return nothing and let `@middy/cloudformation-response` fill the response
	TResult = void | CloudFormationRouteResponse,
>(
	options: Options<NoInfer<TResult>> | Route<NoInfer<TResult>>[],
): RouterHandler<CloudFormationCustomResourceEvent, TResult>;

export declare function cloudformationRouterValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default cloudformationRouterHandler;
