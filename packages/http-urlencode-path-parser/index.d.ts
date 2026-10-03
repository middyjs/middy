// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayEvent, APIGatewayProxyEventV2 } from "aws-lambda";

export type Event = APIGatewayEvent | APIGatewayProxyEventV2;

declare function urlEncodePathParser(): middy.MiddlewareObj<
	Event,
	unknown,
	Error
>;

export declare function httpUrlencodePathParserValidateOptions<
	// The middleware takes no options, so any key fails validation.
	TOptions extends Record<string, never>,
>(options?: TOptions): TOptions;

export default urlEncodePathParser;
