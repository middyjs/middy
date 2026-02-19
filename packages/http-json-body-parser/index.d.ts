// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";

interface Options {
	reviver?: (key: string, value: any) => any;
	disableContentTypeCheck?: boolean;
	disableContentTypeError?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

declare function jsonBodyParser<EventType extends RequestEvent = RequestEvent>(
	options?: Options,
): middy.MiddlewareObj<EventType>;

export default jsonBodyParser;
