import { expectType } from 'tsd'
import middy from '@middy/core'
import { SecretsManager } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import rdsSigner from '.'

// use with default options
let middleware = rdsSigner()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = rdsSigner({
  AwsClient: SecretsManager,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSClient,
  fetchData: { foo: 'bar' },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToEnv: true,
  setToContext: true
})
expectType<middy.MiddlewareObj>(middleware)
