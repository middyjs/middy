import Ajv, { Options as AjvOptions } from 'ajv'

declare function transpileSchema(
  schema: object,
  ajvOptions?: Partial<AjvOptions>
): Ajv

declare function transpileLocale(src: string, options?: object | any): function
