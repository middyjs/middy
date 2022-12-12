import middy from '@middy/core'
import { S3Client } from '@aws-sdk/client-s3'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import s3, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(s3())

const options = {
  AwsClient: S3Client,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      sessionToken: 'token',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSv3Client,
  fetchData: {
    config: {
      Bucket: 'bucket',
      Key: 'path/to/key.ext'
    }
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: true
}

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  s3(options)
)
