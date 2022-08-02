import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import ServiceDiscovery, {
  HttpInstanceSummaryList
} from 'aws-sdk/clients/servicediscovery'

interface Options<S = ServiceDiscovery>
  extends Pick<
    MiddyOptions<S, ServiceDiscovery.Types.ClientConfiguration>,
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
  ? LambdaContext & Record<keyof TOptions['fetchData'], HttpInstanceSummaryList>
  : LambdaContext

declare function serviceDiscovery<TOptions extends Options | undefined>(
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default serviceDiscovery
