import middy from '@middy/core'
import { S3Client } from '@aws-sdk/client-s3'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import s3ObjectResponse, { Context } from '.'

// use with default options
let middleware = s3ObjectResponse()
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  middleware
)

// use with all options
middleware = s3ObjectResponse({
  AwsClient: S3Client,
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  middleware
)
