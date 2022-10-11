import middy from '@middy/core'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { captureAWSClient } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import rdsSigner, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  rdsSigner()
)

const options = {
  AwsClient: SecretsManagerClient,
  awsClientOptions: {
    secretAccessKey: 'abc'
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSClient,
  fetchData: { foo: 'bar' },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: true
}

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  rdsSigner(options)
)
