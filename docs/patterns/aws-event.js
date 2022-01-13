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
import middy from '@middy/core'
import cloudWatchMetricsMiddleware from '@middy/cloudwatch-metrics'
import errorLoggerMiddleware from '@middy/error-logger'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import inputOutputLoggerMiddleware from '@middy/input-output-logger'
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
  .use(cloudWatchMetricsMiddleware())
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(eventNormalizerMiddleware()) // not required for SES
  .use(validatorMiddleware({ inputSchema, outputSchema }))

export default { handler }
