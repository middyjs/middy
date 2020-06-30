import middy from '@middy/core'

interface IURLEncodeBodyParserOptions {
  extended?: boolean;
}

declare const urlEncodeBodyParser : middy.Middleware<IURLEncodeBodyParserOptions, any, any>

export default urlEncodeBodyParser
