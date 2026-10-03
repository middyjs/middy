// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

// import type { JsonValue } from "type-fest";
// Inlined from type-fest 5.9.0 (MIT OR CC0-1.0), Copyright (c) Sindre Sorhus,
// https://github.com/sindresorhus/type-fest/blob/main/source/json-value.d.ts
// so the published types do not import an undeclared package.
type JsonObject = { [Key in string]: JsonValue };
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface Options {
	reviver?: (key: string, value: unknown) => unknown;
}

export type Event = Omit<APIGatewayProxyWebsocketEventV2, "body"> & {
	body: JsonValue;
};

declare function wsJsonBodyParser(
	options?: Options,
): middy.MiddlewareObj<Event, unknown, Error>;

export declare function wsJsonBodyParserValidateOptions<
	TOptions extends Options,
>(options?: TOptions): TOptions;

export default wsJsonBodyParser;
