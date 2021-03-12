import { expectType } from 'tsd'
import middy from '@middy/core'
import httpPartialResponse from '.'

// use with default options
let middleware = httpPartialResponse()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpPartialResponse({
  filteringKeyName: 'something'
})
expectType<middy.MiddlewareObj>(middleware)
