// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { CloudFormationCustomResourceHandler } from "aws-lambda";

interface Route<T = never> {
	requestType: string;
	handler: CloudFormationCustomResourceHandler<T>;
}

export interface Options {
	routes: Route[];
	notFoundResponse?: (input: { requestType: string }) => never;
}

declare function cloudformationRouterHandler(
	options: Options | Route[],
): middy.MiddyfiedHandler;

export default cloudformationRouterHandler;
