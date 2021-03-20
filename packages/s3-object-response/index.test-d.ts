import { expectType } from 'tsd'
import middy from '@middy/core'
import { S3 } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import s3ObjectResponse from '.'

// use with default options
let middleware = s3ObjectResponse()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = s3ObjectResponse({
  AwsClient: S3,
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
