import { expectType } from 'tsd'
import middy from '@middy/core'
import sqsJsonBodyParser from '.'

// use with default options
let middleware = sqsJsonBodyParser()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = sqsJsonBodyParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj>(middleware)
