import middy from '@middy/core'

interface IJsonBodyParserOptions {
  reviver?: (key: string, value: any) => any
}

declare const jsonBodyParser : middy.Middleware<IJsonBodyParserOptions, any, any>

export default jsonBodyParser
