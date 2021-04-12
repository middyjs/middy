import middy from '@middy/core'

interface Options {
  reviver?: (key: string, value: any) => any
}

declare function snsJsonMessageParser (options?: Options): middy.MiddlewareObj

export default snsJsonMessageParser
