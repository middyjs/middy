import middy from '@middy/core'

interface IUrlEncodeBodyParserOptions {
}

declare const urlEncodeBodyParser : middy.Middleware<IUrlEncodeBodyParserOptions, any, any>

export default urlEncodeBodyParser
