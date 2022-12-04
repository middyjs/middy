import middy from '@middy/core'

interface Options {
  eventSchema?: function | any
  contextSchema?: function | any
  responseSchema?: function | any
  defaultLanguage?: string
  languages?: object | any
}

declare function validator (options?: Options): middy.MiddlewareObj

export default validator
