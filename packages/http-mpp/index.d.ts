// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";

export interface MethodOptions {
	method: string;
	recipient: string;
	currency: string;
	amount: number;
}

export interface Options {
	realm?: string;
	methods?: MethodOptions[];
	verify?: (
		token: string,
		request: middy.Request,
	) => boolean | Promise<boolean>;
}

declare function httpMpp(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function httpMppValidateOptions(
	options?: Record<string, unknown>,
): void;

export default httpMpp;
