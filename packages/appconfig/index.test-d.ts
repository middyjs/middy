import middy from '@middy/core'
import { AppConfigDataClient } from '@aws-sdk/client-appconfigdata'
import { Context as LambdaContext } from 'aws-lambda'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import appConfig from '.'

const options = {
  AwsClient: AppConfigDataClient,
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
      ApplicationIdentifier: 'app',
      ConfigurationProfileIdentifier: 'configId',
      EnvironmentIdentifier: 'development'
    }
  },
  disablePrefetch: true,
  cacheKey: 'some-key',
  cacheExpiry: 60 * 60 * 5,
  setToContext: false
} as const

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(
  appConfig()
)

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(
  appConfig(options)
)

// use with setToContext: true
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext & Record<'config', any>>>(
  appConfig({ ...options, setToContext: true })
)

// @ts-expect-error - fetchData must be an object
appConfig({ ...options, fetchData: 'not-an-object' })

appConfig({
  ...options,
  fetchData: {
    config: {
      // @ts-expect-error - Application must be a string
      ApplicationIdentifier: 123,
      // @ts-expect-error - Configuration must be a string
      ConfigurationProfileIdentifier: 123,
      // @ts-expect-error - Environment must be a string
      EnvironmentIdentifier: 123
    }
  }
})

appConfig({
  ...options,
  fetchData: {
    // @ts-expect-error - config must contain Application, ClientId, Configuration and Environment
    config: {}
  }
})
