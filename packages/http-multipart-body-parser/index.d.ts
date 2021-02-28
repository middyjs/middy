import middy from '@middy/core'

interface IMultipartBodyParserOptions {
  busboy?: any
}

declare const multipartBodyParser: middy.Middleware<IMultipartBodyParserOptions, any, any>

export default multipartBodyParser
