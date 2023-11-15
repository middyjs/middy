import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  ServiceDiscoveryClient,
  ServiceDiscoveryClientConfig,
  DiscoverInstancesCommandInput,
  HttpInstanceSummary
} from '@aws-sdk/client-servicediscovery'

interface ServiceDiscoveryOptions<AwsServiceDiscoveryClient = ServiceDiscoveryClient>
  extends Pick<
  MiddyOptions<
  AwsServiceDiscoveryClient,
  ServiceDiscoveryClientConfig
  >,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientCapture'
  | 'disablePrefetch'
  | 'cacheKey'
  | 'cacheExpiry'
  | 'setToContext'
  > {
  fetchData?: { [key: string]: DiscoverInstancesCommandInput }
}

export type Context<TOptions extends ServiceDiscoveryOptions | undefined> =
  TOptions extends { setToContext: true }
    ? TOptions extends { fetchData: infer TFetchData }
      ? LambdaContext & {
        [Key in keyof TFetchData]: HttpInstanceSummary[]
      }
      : never
    : LambdaContext

export type Internal<TOptions extends ServiceDiscoveryOptions | undefined> =
    TOptions extends ServiceDiscoveryOptions
      ? TOptions extends { fetchData: infer TFetchData }
        ? {
            [Key in keyof TFetchData]: HttpInstanceSummary[]
          }
        : {}
      : {}

declare function serviceDiscovery<TOptions extends ServiceDiscoveryOptions | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default serviceDiscovery
