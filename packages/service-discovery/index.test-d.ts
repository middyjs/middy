import middy from '@middy/core'
import { HttpInstanceSummary, ServiceDiscoveryClient } from '@aws-sdk/client-servicediscovery'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { Context as LambdaContext } from 'aws-lambda'
import { expectType } from 'tsd'
import serviceDiscovery, { Context } from '.'
import { getInternal } from '@middy/util'

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
  serviceDiscovery()
)

// use with all options
const options = {
  AwsClient: ServiceDiscoveryClient,
  awsClientOptions: {},
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
}

expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
  serviceDiscovery()
)

const handler = middy(async (event: {}, context: LambdaContext) => {
  return await Promise.resolve({})
})

// setToContext: true
handler.use(
  serviceDiscovery({
    ...options,
    fetchData: { foo: { NamespaceName: 'foo', ServiceName: 'bar' } },
    setToContext: true
  })
)
  .before(async (request) => {
    expectType<HttpInstanceSummary[]>(request.context.foo)

    const data = await getInternal('foo', request)
    expectType<HttpInstanceSummary[]>(data.foo)
  })

// setToContext: false
handler.use(
  serviceDiscovery({
    ...options,
    fetchData: { foo: { NamespaceName: 'foo', ServiceName: 'bar' } },
    setToContext: false
  })
)
  .before(async (request) => {
    const data = await getInternal('foo', request)
    expectType<HttpInstanceSummary[]>(data.foo)
  })
