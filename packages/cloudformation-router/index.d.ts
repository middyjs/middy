// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { CloudFormationCustomResourceHandler } from "aws-lambda";

interface Route<T = never> {
	requestType: string;
	handler: CloudFormationCustomResourceHandler<T>;
}

declare function cloudformationRouterHandler(
	routes: Route[],
): middy.MiddyfiedHandler;

export default cloudformationRouterHandler;
