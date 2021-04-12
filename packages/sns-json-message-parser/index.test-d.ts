import { expectType } from 'tsd'
import middy from '@middy/core'
import snsJsonMessageParser from '.'

// use with default options
let middleware = snsJsonMessageParser()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = snsJsonMessageParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj>(middleware)
