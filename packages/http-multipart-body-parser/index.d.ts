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
	busboy?: {
		headers?: Record<string, string>;
		highWaterMark?: number;
		fileHwm?: number;
		defCharset?: string;
		preservePath?: boolean;
		limits?: {
			fieldNameSize?: number;
			fieldSize?: number;
			fields?: number;
			fileSize?: number;
			files?: number;
			parts?: number;
			headerPairs?: number;
		};
	};
	charset?: string;
	disableContentTypeCheck?: boolean;
	disableContentTypeError?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

export type Event<T extends RequestEvent = RequestEvent> = Omit<T, "body"> & {
	body: JsonValue;
};

declare function multipartBodyParser<
	EventType extends RequestEvent = RequestEvent,
>(options?: Options): middy.MiddlewareObj<Event<EventType>, unknown, Error>;

export default multipartBodyParser;
