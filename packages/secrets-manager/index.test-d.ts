import middy from '@middy/core'
import SecretsManager from 'aws-sdk/clients/secretsmanager'
import { captureAWSClient } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import rdsSigner, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, any, Context<undefined>>>(
  rdsSigner()
)

const options = {
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
  setToContext: true
}

// use with all options
expectType<middy.MiddlewareObj<unknown, any, any, Context<typeof options>>>(
  rdsSigner(options)
)
