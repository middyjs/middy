import middy from '@middy/core'
import S3 from 'aws-sdk/clients/s3'
import { captureAWSClient } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import s3ObjectResponse, { Context } from '.'

// use with default options
let middleware = s3ObjectResponse()
expectType<middy.MiddlewareObj<unknown, any, any, Context<undefined>>>(
  middleware
)

// use with all options
middleware = s3ObjectResponse({
  AwsClient: S3,
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj<unknown, any, any, Context<undefined>>>(
  middleware
)
