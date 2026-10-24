// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	APIGatewayEvent,
	APIGatewayProxyEventV2,
	Context as LambdaContext,
} from "aws-lambda";

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2;

interface BaseOptions {
	FacilitatorClient?: new (config: {
		url?: string;
	}) => {
		verify(payload: unknown, requirements: unknown): Promise<unknown>;
		settle(payload: unknown, requirements: unknown): Promise<unknown>;
	};
	facilitatorUrl?: string;
	versions?: readonly (1 | 2)[];
	price?: number | string;
	amount?: string;
	decimals?: number;
	network?: string;
	payTo: string;
	asset: string;
	description?: string;
	mimeType?: string;
	extra?: Record<string, unknown>;
	/**
	 * Return `true` to skip payment for this request. Only a literal `true`
	 * bypasses; returning a Promise throws a TypeError.
	 */
	human?: (request: middy.Request<RequestEvent>) => boolean;
}

export type Options = BaseOptions &
	({ price: number | string } | { amount: string });

/**
 * The verified payment the middleware writes to `request.internal.x402`. The
 * settlement fields are added in `after`, once the facilitator settles.
 */
export interface X402Internal {
	payload: unknown;
	requirements: unknown;
	payer?: string;
	transaction?: string;
	network?: string;
}

/**
 * `x402` is absent when `human` bypassed payment for the request.
 */
export type Internal = { x402?: X402Internal };

declare function httpX402<EventType extends RequestEvent = RequestEvent>(
	options: Options,
): middy.MiddlewareObj<EventType, unknown, Error, LambdaContext, Internal>;

export declare function httpX402ValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default httpX402;
