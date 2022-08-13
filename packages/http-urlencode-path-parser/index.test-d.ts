import middy from '@middy/core'
import { expectType } from 'tsd'
import urlEncodePathParser, { Event } from '.'

// use with default options
const middleware = urlEncodePathParser()
expectType<middy.MiddlewareObj<Event>>(middleware)
