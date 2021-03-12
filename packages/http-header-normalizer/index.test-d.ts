import { expectType } from 'tsd'
import middy from '@middy/core'
import httpHeaderNormalizer from '.'

// use with default options
let middleware = httpHeaderNormalizer()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpHeaderNormalizer({
  normalizeHeaderKey: (key: string) => key.toLowerCase(),
  canonical: false
})
expectType<middy.MiddlewareObj>(middleware)
