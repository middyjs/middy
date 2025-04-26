import type Ajv from "ajv";
import type { Options as AjvOptions } from "ajv";

export function transpileSchema(
	schema: object,
	ajvOptions?: Partial<AjvOptions>,
): Ajv;

export function transpileLocale(src: string, options?: object | any): Function;
