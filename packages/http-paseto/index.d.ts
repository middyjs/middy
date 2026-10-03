// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
	Context as LambdaContext,
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
	/** Permitted temporal skew, in seconds. */
	clockTolerance?: number;
	/** Maximum token age, in seconds, measured from `iat`. */
	maxTokenAge?: number;
	expectedClaims?: Record<string, string | number | boolean>;
	payloadKey?: string;
	/**
	 * Key on `request.internal` for the verified token as presented.
	 * @default `${payloadKey}Token`
	 */
	tokenKey?: string;
	setToContext?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

/**
 * What the middleware writes to `request.internal`: the verified payload under
 * `payloadKey` and the token as presented under `tokenKey`.
 */
export type Internal<
	TPayloadKey extends string = "paseto",
	TTokenKey extends string = `${TPayloadKey}Token`,
> = { [Key in TPayloadKey]: PasetoPayload } & { [Key in TTokenKey]: string };

/**
 * The Lambda context, with the verified payload under
 * `context.middyContext[payloadKey]` when `setToContext` is `true`.
 */
export type Context<
	TOptions extends Options | undefined,
	TPayloadKey extends string = "paseto",
> = TOptions extends { setToContext: true }
	? LambdaContext & { middyContext: { [Key in TPayloadKey]: PasetoPayload } }
	: LambdaContext;

declare function httpPaseto<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
	TPayloadKey extends string = "paseto",
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

export declare function httpPasetoValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default httpPaseto;
