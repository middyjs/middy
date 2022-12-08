import middy from '@middy/core'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import secretsManager, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  secretsManager()
)

const options = {
  AwsClient: SecretsManagerClient,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      sessionToken: 'token',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSv3Client,
  fetchData: { foo: 'bar' },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: true
}

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  secretsManager(options)
)
