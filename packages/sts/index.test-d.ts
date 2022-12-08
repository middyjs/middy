import middy from '@middy/core'
import { STSClient } from '@aws-sdk/client-sts'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import sts, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(sts())

// use with all options
const options = {
  AwsClient: STSClient,
  credentials: {
    secretAccessKey: 'secret',
    sessionToken: 'token',
    accessKeyId: 'key'
  },
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  sts(options)
)
