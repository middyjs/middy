import { expectType } from 'tsd'
import middy from '@middy/core'
import STS from 'aws-sdk/clients/sts'
import { captureAWSClient } from 'aws-xray-sdk'
import sts from '.'

// use with default options
let middleware = sts()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = sts({
  AwsClient: STS,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
