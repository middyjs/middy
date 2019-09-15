import middy from '@middy/core'

interface IJsonBodyParserOptions {
  reviver?: (key: string, value: any) => any
}

declare function jsonBodyParser(opts: IJsonBodyParserOptions): middy.IMiddyMiddlewareObject;

export default jsonBodyParser
