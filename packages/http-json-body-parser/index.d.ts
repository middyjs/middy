import middy from '@middy/core'

interface Options {
  reviver?: (key: string, value: any) => any,
  rejectMsg?: string
}

declare function jsonBodyParser (options?: Options): middy.MiddlewareObj

export default jsonBodyParser
