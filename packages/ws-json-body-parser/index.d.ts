// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import type { JsonValue } from "type-fest";

export interface Options {
	reviver?: (key: string, value: unknown) => unknown;
}

export type Event = Omit<APIGatewayProxyWebsocketEventV2, "body"> & {
	body: JsonValue;
};

declare function wsJsonBodyParser(
	options?: Options,
): middy.MiddlewareObj<Event, unknown, Error>;

export default wsJsonBodyParser;
