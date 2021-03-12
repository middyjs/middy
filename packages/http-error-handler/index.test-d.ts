import { expectType } from 'tsd'
import { HttpError } from 'http-errors'
import middy from '@middy/core'
import httpErrorHandler from '.'

// use with default options
let middleware = httpErrorHandler()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpErrorHandler({
  logger: (error: HttpError) => console.error(error),
  fallbackMessage: 'whoopsiedoosie!'
})
expectType<middy.MiddlewareObj>(middleware)
