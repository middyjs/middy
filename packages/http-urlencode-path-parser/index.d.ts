// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayEvent } from "aws-lambda";
import type { JsonValue } from "type-fest";

export type Event = APIGatewayEvent & {
	body: JsonValue;
};

declare function urlEncodePathParser(): middy.MiddlewareObj<Event>;

export default urlEncodePathParser;
