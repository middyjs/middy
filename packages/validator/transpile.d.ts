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
 * ajv-keywords, ajv-errors). `allErrors` defaults to false, so validation
 * stops at the first error and an untrusted body cannot produce one error
 * object per item. ajv-errors is only registered with `allErrors: true`; a
 * schema using `errorMessage` without it throws at compile time asking for
 * `{ allErrors: true }`. `ajvOptions.keywords` are registered after the
 * plugins, so a user definition replaces a plugin keyword of the same name.
 */
export function transpileSchema(
	schema: { $async: true; [key: string]: unknown },
	ajvOptions?: Partial<AjvOptions>,
): AsyncValidateFunction;
// `$async` widened to `boolean` (a JSON import, an unannotated const) could be
// either kind, so the result is too.
export function transpileSchema(
	schema: { $async: boolean; [key: string]: unknown },
	ajvOptions?: Partial<AjvOptions>,
): ValidateFunction | AsyncValidateFunction;
export function transpileSchema(
	schema: object,
	ajvOptions?: Partial<AjvOptions>,
): ValidateFunction;

/**
 * Wraps a schema so it validates at `pointer` within a larger event, one
 * `type: "object"` level per pointer segment, each one `required`. Lets a
 * payload schema stay standalone while a second `validator` checks it in place
 * after a parser has replaced the raw value, with no duplicated envelope.
 *
 *
 * @example
 * validator({ eventSchema: transpileSchema(nestedSchema("/body", bodySchema)) })
 */
export function nestedSchema(pointer: string, schema: object): object;

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
