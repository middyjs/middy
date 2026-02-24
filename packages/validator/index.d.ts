// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { ErrorObject } from "ajv";

export interface ValidateFunction<T = unknown> {
	(data: unknown): data is T;
	errors?: ErrorObject[] | undefined;
}

export interface Options {
	eventSchema?: ValidateFunction;
	contextSchema?: ValidateFunction;
	responseSchema?: ValidateFunction;
	defaultLanguage?: string;
	languages?: Record<string, (errors: ErrorObject[] | undefined) => void>;
}

declare function validator(options?: Options): middy.MiddlewareObj;

export default validator;
