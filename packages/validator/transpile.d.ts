// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Ajv, ErrorObject, Options as AjvOptions } from "ajv";

export type LocalizeFunction = (errors: ErrorObject[] | undefined) => void;

export function transpileSchema(
	schema: object,
	ajvOptions?: Partial<AjvOptions>,
): Ajv;

export function transpileLocale(
	src: string,
	options?: object | any,
): LocalizeFunction;

export function transpileFTL(
	src: string,
	options?: object | any,
): LocalizeFunction;
