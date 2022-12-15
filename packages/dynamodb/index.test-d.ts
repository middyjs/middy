import middy from '@middy/core'
import { Context as LambdaContext } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectError, expectType } from 'tsd'
import dynamodb, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  dynamodb()
)

const options = {
  AwsClient: DynamoDBClient,
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
    superSecretAccessToken: {
      TableName: 'superSecretTable',
      Key: {
        pk: {
          S: 'superSecretKey'
        }
      }
    }
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: false
} as const

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(
  dynamodb(options)
)

// use with setToContext: true
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext & Record<'superSecretAccessToken', any>>>(
  dynamodb({ ...options, setToContext: true })
)

// @ts-expect-error - fetchData is required
expectError(dynamodb({ ...options, fetchData: undefined }))

