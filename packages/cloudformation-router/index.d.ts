// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { CloudFormationCustomResourceEvent, Context } from "aws-lambda";

// One call signature that a plain Lambda handler, a middyfied handler and an
// inline arrow all satisfy, including a synchronous handler (Lambda's `Handler`
// only allows `void | Promise`). The rest parameter absorbs Lambda's `callback`
// and middy's `opts`; the router passes neither.
export type RouteHandler<TEvent, TResult> = (
	event: TEvent,
	context: Context,
	...rest: any[]
	// biome-ignore lint/suspicious/noConfusingVoidType: Lambda's `Handler` returns `void | Promise<TResult>`, and `undefined` would refuse it
) => void | TResult | Promise<TResult>;

// `TResult` was previously forwarded to `CloudFormationCustomResourceHandler`,
// whose first parameter is the resource-properties type, so the default of
// `never` typed every route's `event.ResourceProperties` as `never`.
export interface Route<TResult = void> {
	requestType: "Create" | "Update" | "Delete";
	handler: RouteHandler<CloudFormationCustomResourceEvent, TResult>;
}

export type RouteNotFoundResponseFn = (input: {
	requestType: string;
}) => unknown;

export interface Options {
	routes: Route[];
	notFoundResponse?: RouteNotFoundResponseFn;
}

declare function cloudformationRouterHandler(
	options: Options | Route[],
): middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>;

export declare function cloudformationRouterValidateOptions(
	options?: Record<string, unknown>,
): void;

export default cloudformationRouterHandler;
