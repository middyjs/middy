import middy from '@middy/core'

import Ajv, { Options as AjvOptions } from 'ajv'

interface Options {
  inputSchema?: object | any
  outputSchema?: object | any
  ajvOptions?: Partial<AjvOptions>
  ajvInstance?: Ajv
  defaultLanguage?: string
  i18nEnabled?: boolean
}

declare function validator (options?: Options): middy.MiddlewareObj

export default validator
