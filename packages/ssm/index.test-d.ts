import middy from '@middy/core'
import { SSMClient } from '@aws-sdk/client-ssm'
import { captureAWSClient } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import ssm, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(ssm())

// use with all options
const options = {
  AwsClient: SSMClient,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  ssm(options)
)
