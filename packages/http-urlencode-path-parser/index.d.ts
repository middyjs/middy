// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayEvent } from "aws-lambda";

export type Event = APIGatewayEvent;

declare function urlEncodePathParser(): middy.MiddlewareObj<
	Event,
	unknown,
	Error
>;

export default urlEncodePathParser;
