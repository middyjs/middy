import middy from '@middy/core'
import { SSMClient } from '@aws-sdk/client-ssm'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType, expectAssignable } from 'tsd'
import ssm, { Context } from '.'
import { JsonValue } from 'type-fest'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context>>(ssm())

// use with all options
const options = {
  AwsClient: SSMClient,
  awsClientOptions: {
    credentials: {
      secretAccessKey: 'secret',
      sessionToken: 'token',
      accessKeyId: 'key'
    }
  },
  awsClientAssumeRole: 'some-role',
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  ssm(options)
)

// checks that values fetched are actually enriching the context correctly (#1084)
middy()
  .use(
    ssm({
      fetchData: {
        accessToken: '/dev/service_name/access_token', // single value
        dbParams: '/dev/service_name/database/', // object of values, key for each path
        defaults: '/dev/defaults'
      },
      setToContext: true
    })
  )
  .before((request) => {
    // checks that the context is correctly enriched in before
    expectAssignable<Context & Record<'accessToken' | 'dbParams' | 'defaults', JsonValue>>(request.context)
  })
  .handler(async (req, context) => {
    // checks that the context is correctly enriched in handler
    expectAssignable<Record<'accessToken' | 'dbParams' | 'defaults', JsonValue>>(context)
  })
