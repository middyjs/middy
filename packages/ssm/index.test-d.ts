import middy from '@middy/core'
import { getInternal } from '@middy/util'
import { SSMClient } from '@aws-sdk/client-ssm'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { expectType } from 'tsd'
import ssm, { Context } from '.'
import { JsonValue } from 'type-fest'
import { Context as LambdaContext } from 'aws-lambda/handler'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(ssm())

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

expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext, Record<'lorem' | 'ipsum', JsonValue>>>(
  ssm({
    fetchData: {
      lorem: '/lorem',
      ipsum: '/lorem'
    }
  })
)

const handler = middy(async (event: {}, context: LambdaContext) => {
  return await Promise.resolve({})
})

handler
  .use(
    ssm({
      fetchData: {
        defaults: '/dev/defaults'
      },
      cacheKey: 'ssm-defaults'
    })
  )
  .use(
    ssm({
      fetchData: {
        accessToken: '/dev/service_name/access_token', // single value
        dbParams: '/dev/service_name/database/' // object of values, key for each path
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'ssm-secrets'
    })
  )
  // ... other middleware that fetch
  .before(async (request) => {
    const data = await getInternal(
      ['accessToken', 'dbParams', 'defaults'],
      request
    )
    expectType<{
      accessToken: JsonValue
      dbParams: JsonValue
      defaults: JsonValue
    }>(data)
    Object.assign(request.context, data)
  })
