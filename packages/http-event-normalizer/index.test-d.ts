import middy from '@middy/core'
import { expectType } from 'tsd'
import httpEventNormalizer, { Event } from '.'

// use with default options
let middleware = httpEventNormalizer()
expectType<middy.MiddlewareObj<Event>>(middleware)

// use with all options
middleware = httpEventNormalizer()
expectType<middy.MiddlewareObj<Event>>(middleware)
