import middy from '@middy/core'

interface ISQSJsonBodyParserOptions {
  reviver?: (key: string, value: any) => any
  safeParse?: (body: string) => any
}

declare const sqsJsonBodyParser: middy.Middleware<ISQSJsonBodyParserOptions, any, any>

export default sqsJsonBodyParser
