// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	CloudFormationCustomResourceEvent,
	CloudFormationCustomResourceHandler,
} from "aws-lambda";

export interface Route<TResult = never> {
	requestType: string;
	handler: CloudFormationCustomResourceHandler<TResult>;
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

export default cloudformationRouterHandler;
