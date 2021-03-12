import { expectType } from 'tsd'
import middy from '@middy/core'
import { SQS } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import sqsPartialBatchFailure from '.'

// use with default options
let middleware = sqsPartialBatchFailure()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = sqsPartialBatchFailure({
  AwsClient: SQS,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
