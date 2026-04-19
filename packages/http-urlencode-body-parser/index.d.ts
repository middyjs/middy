// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import type { JsonValue } from "type-fest";

export interface Options {
	disableContentTypeCheck?: boolean;
	disableContentTypeError?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

export type Event<T extends RequestEvent = RequestEvent> = T & {
	body: JsonValue;
};

declare function urlEncodeBodyParser<
	EventType extends RequestEvent = RequestEvent,
>(options?: Options): middy.MiddlewareObj<Event<EventType>, unknown, Error>;

export declare function httpUrlencodeBodyParserValidateOptions(
	options?: Record<string, unknown>,
): void;

export default urlEncodeBodyParser;
