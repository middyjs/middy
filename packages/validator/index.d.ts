import middy from '@middy/core'

import { Options as AjvOptions } from 'ajv'

interface IValidatorOptions {
  inputSchema?: object|any
  outputSchema?: object|any
  ajvOptions?: Partial<AjvOptions>
  ajvInstance?: any // Ajv
  defaultLanguage?: string
}

declare const validator: middy.Middleware<IValidatorOptions, any, any>

export default validator
