import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  ServiceDiscoveryClient,
  ServiceDiscoveryClientConfig,
  HttpInstanceSummary
} from '@aws-sdk/client-servicediscovery'

interface Options<AwsServiceDiscoveryClient = ServiceDiscoveryClient>
  extends Pick<
  MiddyOptions<
  AwsServiceDiscoveryClient,
  ServiceDiscoveryClientConfig
  >,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientCapture'
  | 'fetchData'
  | 'disablePrefetch'
  | 'cacheKey'
  | 'cacheExpiry'
  | 'setToContext'
  > {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], HttpInstanceSummary>
  : LambdaContext

declare function serviceDiscovery<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default serviceDiscovery
