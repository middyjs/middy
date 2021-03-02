import { expectType } from 'tsd'
import middy from '@middy/core'
import httpEventNormalizer from '.'

// use with default options
let middleware = httpEventNormalizer()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpEventNormalizer({
  payloadFormatVersion: 2
})
expectType<middy.MiddlewareObj>(middleware)
