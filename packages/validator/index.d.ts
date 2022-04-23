import middy from '@middy/core'

import Ajv, { Options as AjvOptions } from 'ajv'

interface Options {
  inputSchema?: object | any // Deprecate v4
  outputSchema?: object | any // Deprecate v4
  eventSchema?: object | any
  contextSchema?: object | any
  responseSchema?: object | any
  ajvOptions?: Partial<AjvOptions>
  ajvInstance?: Ajv
  defaultLanguage?: string
  i18nEnabled?: boolean
}

declare function validator (options?: Options): middy.MiddlewareObj

export default validator
