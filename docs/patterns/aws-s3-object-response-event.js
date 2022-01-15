/**
 * Trigger Lambda from AWS Event
 * S3 Object: https://docs.aws.amazon.com/lambda/latest/dg/services-s3-object-lambda.html
 **/
import middy from '@middy/core'
import errorLoggerMiddleware from '@middy/error-logger'
import inputOutputLoggerMiddleware from '@middy/input-output-logger'
import s3ObjectResponseMiddleware from '@middy/s3-object-response'
import validatorMiddleware from 'validator' // or `middy-ajv`
import warmupMiddleware from 'warmup'

import inputSchema from './requestEvent.json' // assert { type: 'json' }
import outputSchema from './response.json' // assert { type: 'json' }

const lambdaHandler = async (event, context) => {
  const body = await context.s3Object
  return {
    Body: body
  }
}

const config = {
  timeoutEarlyInMillis: 50
}

const handler = middy(lambdaHandler, config)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(validatorMiddleware({ inputSchema, outputSchema }))
  .use(s3ObjectResponseMiddleware({
    bodyType: 'promise'
  }))

export default { handler }
