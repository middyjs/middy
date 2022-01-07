/**
 * Trigger Lambda from AWS Event
 * SQS: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
 **/
const middy = require('@middy/core')
const errorLoggerMiddleware = require('@middy/error-logger')
const eventNormalizerMiddleware = require('@middy/event-normalizer')
const inputOutputLoggerMiddleware = require('@middy/input-output-logger')
const sqsPartialBatchFailureMiddleware = require('@middy/sqs-partial-batch-failure-middleware')
const validatorMiddleware = require('validator') // or `middy-ajv`
const warmupMiddleware = require('warmup')

const inputSchema = require('./requestEvent.json')
const outputSchema = require('./response.json')

const baseHandler = () => {
  return true
}

const handler = middy(baseHandler)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(eventNormalizerMiddleware())
  .use(validatorMiddleware({ inputSchema, outputSchema }))
  // Start On
  .use(sqsPartialBatchFailureMiddleware())

module.exports = { handler }
