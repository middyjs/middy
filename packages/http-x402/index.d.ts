// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { APIGatewayEvent, APIGatewayProxyEventV2 } from "aws-lambda";

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
	human?: (request: middy.Request<RequestEvent>) => boolean;
}

export type Options = BaseOptions &
	({ price: number | string } | { amount: string });

declare function httpX402<EventType extends RequestEvent = RequestEvent>(
	options: Options,
): middy.MiddlewareObj<EventType, unknown, Error>;

export declare function httpX402ValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpX402;
