import middy from '@middy/core'

import Ajv, { Options as AjvOptions } from 'ajv'

interface Options {
  inputSchema?: object | any
  outputSchema?: object | any
  ajvOptions?: Partial<AjvOptions>
  ajvInstance?: Ajv
  defaultLanguage?: string
}

declare function validator (options?: Options): middy.MiddlewareObj

export default validator
