import { expectType } from 'tsd'
import middy from '@middy/core'
import sqsPartialBatchFailure from '.'

// use with default options
let middleware = sqsPartialBatchFailure()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = sqsPartialBatchFailure({
  awsClientOptions: {
    logger: console
  }
})
expectType<middy.MiddlewareObj>(middleware)
