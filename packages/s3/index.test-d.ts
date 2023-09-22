import middy from '@middy/core'
import { Context as LambdaContext } from 'aws-lambda'
import { S3Client } from '@aws-sdk/client-s3'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import s3 from '.'

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
    someS3Object: s3FetchData<{key: string}>({
      Bucket: 'bucket',
      Key: 'path/to/key.json' // {key: 'value'}
    })
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: false
} as const

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(s3())

// use with all options
expectType < middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(
  s3(options)
)

// use with setToContext: true
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext & Record<'someS3Object', any>>>(
  s3({
    ...options,
    setToContext: true
  }
  ))

// @ts-expect-error - fetchData must be an object
s3({ ...options, fetchData: 'not an object' })

s3({
  ...options,
  fetchData: {
    someS3Object: {
      // @ts-expect-error - Valid bucket name is required
      Bucket: null,
      // @ts-expect-error - Valid key is required
      Key: null
    }
  }
})

s3({
  ...options,
  fetchData: {
    someS3Object: {
      Bucket: 'bucket',
      Key: 'path/to/key.ext',

      // @ts-expect-error - ChecksumMode is not a valid parameter
      ChecksumMode: 'none'
    }
  }
})
