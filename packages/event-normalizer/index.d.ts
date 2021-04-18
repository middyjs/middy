import middy from '@middy/core'

interface Options {
  reviver?: (key: string, value: any) => any
}

declare function sqsJsonBodyParser (options?: Options): middy.MiddlewareObj

export default sqsJsonBodyParser
