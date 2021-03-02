import middy from '@middy/core'

interface Options {
  reviver?: (key: string, value: any) => any
}

declare function jsonBodyParser (options?: Options): middy.MiddlewareObj

export default jsonBodyParser
