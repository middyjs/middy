import middy from '@middy/core'

interface IMultipartBodyParserOptions {
  busyboy?: any
}

declare const multipartBodyParser : middy.Middleware<IMultipartBodyParserOptions, any, any>

export default multipartBodyParser
