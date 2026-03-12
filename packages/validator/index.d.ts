// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Ajv, ErrorObject } from "ajv";

export interface Options {
	eventSchema?: Ajv;
	contextSchema?: Ajv;
	responseSchema?: Ajv;
	defaultLanguage?: string;
	languages?: Record<
		string,
		(errors: ErrorObject[] | null | undefined) => void
	>;
}

declare function validator(
	options?: Options,
): middy.MiddlewareObj<unknown, unknown, Error>;

export default validator;
