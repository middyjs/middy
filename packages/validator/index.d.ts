// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { AsyncValidateFunction, ErrorObject, ValidateFunction } from "ajv";

export interface Options {
	eventSchema?: ValidateFunction | AsyncValidateFunction;
	contextSchema?: ValidateFunction | AsyncValidateFunction;
	responseSchema?: ValidateFunction | AsyncValidateFunction;
	defaultLanguage?: string;
	languages?: Record<
		string,
		(errors: ErrorObject[] | null | undefined) => void
	>;
	/**
	 * Where @middy/http-content-negotiation published its results. Must match
	 * that middleware's `contextKey` when it has been overridden.
	 * @default "http-content-negotiation"
	 */
	contextKeyHttpContentNegotiation?: string;
}

declare function validator(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export declare function validatorValidateOptions(
	options?: Record<string, unknown>,
): void;

export default validator;
