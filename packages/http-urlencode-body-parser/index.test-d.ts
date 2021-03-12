import { expectType } from 'tsd'
import middy from '@middy/core'
import urlEncodeBodyParser from '.'

// use with default options
const middleware = urlEncodeBodyParser()
expectType<middy.MiddlewareObj>(middleware)
