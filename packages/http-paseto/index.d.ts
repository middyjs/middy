// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";

export interface PasetoPayload {
	[key: string]: unknown;
	iss?: string;
	sub?: string;
	aud?: string;
	exp?: string;
	nbf?: string;
	iat?: string;
	jti?: string;
}

export interface Options {
	internalKey?: string;
	tokenCookieName?: string;
	tokenHeaderName?: string;
	tokenQueryStringName?: string;
	audience?: string;
	issuer?: string;
	clockTolerance?: string;
	payloadKey?: string;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

declare function httpPaseto<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
>(options?: TOptions): middy.MiddlewareObj<EventType, unknown, Error>;

export declare function httpPasetoValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpPaseto;
