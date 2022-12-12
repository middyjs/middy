import middy from '@middy/core'
import { AppConfigClient } from '@aws-sdk/client-appconfig'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import appConfig, { Context } from '.'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  appConfig()
)

const options = {
  AwsClient: AppConfigClient,
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
      Application: 'app',
      ClientId: '0001',
      Configuration: 'lambda-n',
      Environment: 'development'
    }
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: true
}

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  appConfig(options)
)
