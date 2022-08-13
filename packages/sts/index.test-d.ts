import middy from '@middy/core'
import STS from 'aws-sdk/clients/sts'
import { captureAWSClient } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import sts, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(sts())

// use with all options
const options = {
  AwsClient: STS,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  sts(options)
)
