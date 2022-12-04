import middy from '@middy/core'

import Ajv, { Options as AjvOptions } from 'ajv'

interface Options {
  eventSchema?: object | any
  contextSchema?: object | any
  responseSchema?: object | any
  defaultLanguage?: string
  languages?: object | any
}

declare function validator(options?: Options): middy.MiddlewareObj

export default validator
