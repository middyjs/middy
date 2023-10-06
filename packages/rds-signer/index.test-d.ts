import { expectType } from 'tsd'
import middy from '@middy/core'
import { Signer } from '@aws-sdk/rds-signer'
import rdsSigner from '.'

// use with default options
let middleware = rdsSigner()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = rdsSigner({
  AwsClient: Signer,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  fetchData: {
    foo: {
      region: 'ca-central-1',
      hostname: '***.rds.amazonaws.com',
      username: 'iam_role',
      database: 'postgres',
      port: 5432
    }
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: true
})
expectType<middy.MiddlewareObj>(middleware)
