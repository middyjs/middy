import middy from '@middy/core'
import { getInternal } from '@middy/util'
import { expectType, expectAssignable } from 'tsd'
import parametersSecretsLambdaExtension, {
  Context,
  parametersSecretsLambdaExtensionParam
} from '.'
import { Context as LambdaContext } from 'aws-lambda/handler'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  parametersSecretsLambdaExtension()
)

// use with all options
const options = {
  type: 'secretsmanager',
  disablePrefetch: true
}
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  parametersSecretsLambdaExtension(options)
)

expectType<
  middy.MiddlewareObj<
    unknown,
    any,
    Error,
    LambdaContext,
    Record<'lorem' | 'ipsum', unknown>
  >
>(
  parametersSecretsLambdaExtension({
    type: 'systemsmanager',
    fetchData: {
      lorem: '/lorem',
      ipsum: '/lorem'
    }
  })
)

const handler = middy(async (event: {}, context: LambdaContext) => {
  return await Promise.resolve({})
})

// chain of multiple ssm middleware
handler
  .use(
    parametersSecretsLambdaExtension({
      type: 'systemsmanager',
      fetchData: {
        defaults: parametersSecretsLambdaExtensionParam<string>('/dev/defaults')
      },
      cacheKey: 'ssm-defaults'
    })
  )
  .use(
    parametersSecretsLambdaExtension({
      type: 'secretsmanager',
      fetchData: {
        accessToken: parametersSecretsLambdaExtensionParam<string>(
          '/dev/service_name/access_token'
        ), // single value
        dbParams: parametersSecretsLambdaExtensionParam<{
          user: string
          pass: string
        }>('/dev/service_name/database/') // object of values, key for each path
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'rds-secrets',
      setToContext: true
    })
  )
  // ... other middleware that fetch
  .before(async (request) => {
    const data = await getInternal(
      ['accessToken', 'dbParams', 'defaults'],
      request
    )

    expectType<string>(data.accessToken)
    expectType<{ user: string; pass: string }>(data.dbParams)
    expectType<string>(data.defaults)
  })
