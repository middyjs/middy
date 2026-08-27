// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
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

declare function httpDpop<
	TOptions extends Options = Options,
	EventType extends RequestEvent = RequestEvent,
>(options?: TOptions): middy.MiddlewareObj<EventType, unknown, Error>;

export declare function httpDpopValidateOptions(
	options?: Record<string, unknown>,
): void;

export declare function jwkThumbprint(jwk: Record<string, unknown>): string;

export declare function accessTokenHash(token: string): string;

export declare function verifyDpopProof(
	proof: string,
	options?: {
		method?: string;
		url?: string;
		accessToken?: string;
		algorithms?: DpopAlgorithm[];
		maxAge?: number;
	},
): { jkt: string; claims: DpopProofClaims };

export default httpDpop;
