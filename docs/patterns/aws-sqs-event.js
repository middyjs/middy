/**
 * Trigger Lambda from AWS Event
 * SQS: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
 **/
import middy from '@middy/core'
import errorLoggerMiddleware from '@middy/error-logger'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import inputOutputLoggerMiddleware from '@middy/input-output-logger'
import sqsPartialBatchFailureMiddleware from '@middy/sqs-partial-batch-failure-middleware'
import validatorMiddleware from 'validator' // or `middy-ajv`
import warmupMiddleware from 'warmup'

import inputSchema from './requestEvent.json' // assert { type: 'json' }
import outputSchema from './response.json' // assert { type: 'json' }

const baseHandler = () => {
  return true
}

const config = {
  timeoutEarlyInMillis: 50
}

const handler = middy(baseHandler, config)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(eventNormalizerMiddleware())
  .use(validatorMiddleware({ inputSchema, outputSchema }))
  .use(sqsPartialBatchFailureMiddleware())

export default { handler }
