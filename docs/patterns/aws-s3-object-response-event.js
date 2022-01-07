/**
 * Trigger Lambda from AWS Event
 * S3 Object: https://docs.aws.amazon.com/lambda/latest/dg/services-s3-object-lambda.html
 **/
const middy = require('@middy/core')
const errorLoggerMiddleware = require('@middy/error-logger')
const inputOutputLoggerMiddleware = require('@middy/input-output-logger')
const s3ObjectResponseMiddleware = require('@middy/s3-object-response')
const validatorMiddleware = require('validator') // or `middy-ajv`
const warmupMiddleware = require('warmup')

const inputSchema = require('./requestEvent.json')
const outputSchema = require('./response.json')

const baseHandler = async (event, context) => {
  const body = await context.s3Object
  return {
    Body: body
  }
}

const handler = middy(baseHandler)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(validatorMiddleware({ inputSchema, outputSchema }))
  .use(s3ObjectResponseMiddleware({
    bodyType: 'promise'
  }))

module.exports = { handler }
