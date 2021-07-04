import { expectType } from 'tsd'
import middy from '@middy/core'
import inputOutputLogger from '.'

// use with default options
let middleware = inputOutputLogger()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = inputOutputLogger({
  logger: console.log,
  awsContext: true,
  omitPaths: ['a', 'b', 'c']
})
expectType<middy.MiddlewareObj>(middleware)
