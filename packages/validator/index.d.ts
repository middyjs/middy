// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ErrorObject, ValidateFunction } from "ajv";

// A synchronous ajv validator. `$async` validators throw at construction, and
// ajv's `AsyncValidateFunction` extends `ValidateFunction`, so its `$async: true`
// is ruled out explicitly.
export type SyncValidateFunction = ValidateFunction & { $async?: never };

export interface Options {
	eventSchema?: SyncValidateFunction;
	contextSchema?: SyncValidateFunction;
	responseSchema?: SyncValidateFunction;
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

export declare function validatorValidateOptions<TOptions extends Options>(
	options?: TOptions,
): TOptions;

export default validator;
