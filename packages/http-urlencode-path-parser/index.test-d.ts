import { expectType } from 'tsd'
import middy from '@middy/core'
import urlEncodePathParser from '.'

// use with default options
const middleware = urlEncodePathParser()
expectType<middy.MiddlewareObj>(middleware)
