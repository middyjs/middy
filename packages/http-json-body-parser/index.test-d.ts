import { expectType } from 'tsd'
import middy from '@middy/core'
import jsonBodyParser from '.'

// use with default options
let middleware = jsonBodyParser()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = jsonBodyParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj>(middleware)
