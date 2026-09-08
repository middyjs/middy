// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	Options as AjvOptions,
	AsyncValidateFunction,
	ErrorObject,
	ValidateFunction,
} from "ajv";

export type LocalizeFunction = (
	errors: ErrorObject[] | null | undefined,
) => void;

/**
 * Compiles a JSON Schema into an ajv validate function using the same plugin
 * set as `ajv-cmd/compile` (ajv-formats, @silverbucket/ajv-formats-draft2019,
 * ajv-keywords, ajv-errors). `ajvOptions.keywords` are registered after the
 * plugins, so a user definition replaces a plugin keyword of the same name.
 */
export function transpileSchema(
	schema: object,
	ajvOptions?: Partial<AjvOptions>,
): ValidateFunction | AsyncValidateFunction;

/**
 * Transpiles Fluent (.ftl) source into the ESM source text of an ajv
 * localizer module (re-export of `transpile` from `ajv-ftl-i18n`). Write the
 * result to a file during a build step and import it as a `languages` entry.
 */
export function transpileFTL(
	ftl: string,
	options?: {
		locale?: string | string[];
		comments?: boolean;
		[key: string]: unknown;
	},
): string;
