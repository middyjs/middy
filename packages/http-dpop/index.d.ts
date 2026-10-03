// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
	Context as LambdaContext,
} from "aws-lambda";

export type DpopAlgorithm =
	| "ES256"
	| "ES384"
	| "ES512"
	| "PS256"
	| "RS256"
	| "EdDSA";

export interface DpopProofClaims {
	[key: string]: unknown;
	jti: string;
	htm: string;
	htu: string;
	iat: number;
	ath?: string;
	nonce?: string;
}

export interface Options {
	payloadKey?: string;
	/**
	 * Key on `request.internal` holding the token the verifier checked.
	 * @default `${payloadKey}Token`
	 */
	tokenKey?: string;
	proofKey?: string;
	confirmationClaim?: string;
	origin?: string;
	algorithm?: DpopAlgorithm | DpopAlgorithm[];
	maxAge?: number;
	maxProofLength?: number;
	required?: boolean;
	setToContext?: boolean;
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent;

// The claims are written only for a DPoP-bound token, so they are absent for a
// bearer token unless `required` rejects those.
type ProofClaims<TOptions extends Options | undefined> = TOptions extends {
	required: true;
}
	? DpopProofClaims
	: DpopProofClaims | undefined;

/**
 * What the middleware writes to `request.internal`: the verified proof claims
 * under `proofKey`.
 */
export type Internal<
	TOptions extends Options | undefined = Options,
	TProofKey extends string = "dpop",
> = { [Key in TProofKey]: ProofClaims<TOptions> };

/**
 * The Lambda context, with the verified proof claims under
 * `context.middyContext[proofKey]` when `setToContext` is `true`.
 */
export type Context<
	TOptions extends Options | undefined,
	TProofKey extends string = "dpop",
> = TOptions extends { setToContext: true }
	? LambdaContext & {
			middyContext: { [Key in TProofKey]: ProofClaims<TOptions> };
		}
	: LambdaContext;

declare function httpDpop<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
	TProofKey extends string = "dpop",
>(
	// `TProofKey` keeps a `proofKey` literal from widening to `string`, so it
	// narrows `request.internal` without `as const`. The `never` record rejects
	// keys `Options` does not declare.
	options?: TOptions & { proofKey?: TProofKey } & Record<
			Exclude<keyof TOptions, keyof Options>,
			never
		>,
): middy.MiddlewareObj<
	EventType,
	unknown,
	Error,
	Context<TOptions, TProofKey>,
	Internal<TOptions, TProofKey>
>;

export declare function httpDpopValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export declare function jwkThumbprint(jwk: Record<string, unknown>): string;

export declare function accessTokenHash(token: string): string;

export declare function verifyDpopProof(
	proof: string,
	options: {
		method: string;
		url?: string;
		accessToken?: string;
		algorithms?: DpopAlgorithm[];
		maxAge?: number;
	},
): { jkt: string; claims: DpopProofClaims };

export default httpDpop;
