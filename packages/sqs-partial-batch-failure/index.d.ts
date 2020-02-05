import middy from '@middy/core'

interface ISqsBatchOptions {
  sqs?: object;
}

declare const sqsBatch: middy.Middleware<ISqsBatchOptions, any, any>

export default sqsBatch
