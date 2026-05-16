// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import type { JWTPayload } from "jose";

export interface IssuerConfig {
	jwksUri: string;
	audience?: string | string[];
	algorithm?: string | string[];
}

export interface Options {
	internalKey?: string;
	issuers?: Record<string, IssuerConfig>;
	tokenCookieName?: string;
	tokenHeaderName?: string;
	tokenQueryStringName?: string;
	algorithm?: string | string[];
	audience?: string | string[];
	issuer?: string | string[];
	clockTolerance?: number;
	payloadKey?: string;
	setToContext?: boolean;
	cacheExpiry?: number;
	cooldownDuration?: number;
	disablePrefetch?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

declare function httpJwt<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
>(options?: TOptions): middy.MiddlewareObj<EventType, unknown, Error>;

export declare function httpJwtValidateOptions(
	options?: Record<string, unknown>,
): void;

export type { JWTPayload };

export default httpJwt;
