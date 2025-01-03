import { expectType } from 'tsd'
import middy from '@middy/core'
import cloudformationResponse from '.'

// use with default options
let middleware = cloudformationResponse()
expectType<middy.MiddlewareObj>(middleware)
