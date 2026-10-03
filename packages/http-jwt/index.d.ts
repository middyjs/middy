// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
	Context as LambdaContext,
} from "aws-lambda";
import type { JWTPayload } from "jose";

export interface IssuerConfig {
	jwksUri: string;
	audience?: string | string[];
	algorithm?: string | string[];
	/** Overrides the top-level `typ` for this issuer; `null` disables the check. */
	typ?: string | null;
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
	/**
	 * Expected JWS `typ` header (RFC 9068 section 4). Defaults to "at+jwt";
	 * `null` disables the check. Compared case-insensitively, with an optional
	 * "application/" prefix. Applies to `issuers` unless an issuer overrides it.
	 */
	typ?: string | null;
	clockTolerance?: number;
	requireExp?: boolean;
	maxTokenAge?: string | number;
	expectedClaims?: Record<string, string | number | boolean>;
	payloadKey?: string;
	/**
	 * Key on `request.internal` for the verified token as presented.
	 * @default `${payloadKey}Token`
	 */
	tokenKey?: string;
	setToContext?: boolean;
	cacheExpiry?: number;
	cooldownDuration?: number;
	jwksTimeoutMs?: number;
	disablePrefetch?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

/**
 * What the middleware writes to `request.internal`: the verified payload under
 * `payloadKey` and the token as presented under `tokenKey`.
 */
export type Internal<
	TPayloadKey extends string = "jwt",
	TTokenKey extends string = `${TPayloadKey}Token`,
> = { [Key in TPayloadKey]: JWTPayload } & { [Key in TTokenKey]: string };

/**
 * The Lambda context, with the verified payload under
 * `context.middyContext[payloadKey]` when `setToContext` is `true`.
 */
export type Context<
	TOptions extends Options | undefined,
	TPayloadKey extends string = "jwt",
> = TOptions extends { setToContext: true }
	? LambdaContext & { middyContext: { [Key in TPayloadKey]: JWTPayload } }
	: LambdaContext;

declare function httpJwt<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
	TPayloadKey extends string = "jwt",
	TTokenKey extends string = `${TPayloadKey}Token`,
>(
	// `TPayloadKey` and `TTokenKey` keep the key literals from widening to
	// `string`, so they narrow `request.internal` without `as const`. The `never`
	// record rejects keys `Options` does not declare.
	options?: TOptions & {
		payloadKey?: TPayloadKey;
		tokenKey?: TTokenKey;
	} & Record<Exclude<keyof TOptions, keyof Options>, never>,
): middy.MiddlewareObj<
	EventType,
	unknown,
	Error,
	Context<TOptions, TPayloadKey>,
	Internal<TPayloadKey, TTokenKey>
>;

export declare function httpJwtValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export type { JWTPayload };

export default httpJwt;
