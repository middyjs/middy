import { expectType } from 'tsd'
import middy from '@middy/core'
import SSM from 'aws-sdk/clients/ssm'
import { captureAWSClient } from 'aws-xray-sdk'
import ssm from '.'

// use with default options
let middleware = ssm()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = ssm({
  AwsClient: SSM,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
