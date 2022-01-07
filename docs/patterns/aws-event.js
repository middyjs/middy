/**
 * Trigger Lambda from AWS Event
 * DynamoDB: https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html
 * Kinesis Firehose: https://docs.aws.amazon.com/lambda/latest/dg/services-kinesisfirehose.html
 * Kinesis Stream: https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html
 * RDS (via SNS): https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html
 * S3: https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html
 * SES: https://docs.aws.amazon.com/lambda/latest/dg/services-ses.html
 * SNS: https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html
 **/
const middy = require('@middy/core')
const cloudWatchMetricsMiddleware = require('@middy/cloudwatch-metrics')
const errorLoggerMiddleware = require('@middy/error-logger')
const eventNormalizerMiddleware = require('@middy/event-normalizer')
const inputOutputLoggerMiddleware = require('@middy/input-output-logger')
const validatorMiddleware = require('validator') // or `middy-ajv`
const warmupMiddleware = require('warmup')

const inputSchema = require('./requestEvent.json')
const outputSchema = require('./response.json')

const baseHandler = () => {
  return true
}

const config = {
  timeoutEarlyInMillis: 50
}

const handler = middy(baseHandler, config)
  .use(cloudWatchMetricsMiddleware())
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(eventNormalizerMiddleware()) // not required for SES
  .use(validatorMiddleware({ inputSchema, outputSchema }))

module.exports = { handler }
