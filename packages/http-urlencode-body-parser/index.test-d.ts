import middy from '@middy/core'
import { expectType } from 'tsd'
import urlEncodeBodyParser, { Event } from '.'

// use with default options
const middleware = urlEncodeBodyParser()
expectType<middy.MiddlewareObj<Event>>(middleware)
