import { ServiceDiscovery } from 'aws-sdk'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = ServiceDiscovery>
  extends Pick<MiddyOptions<S, ServiceDiscovery.Types.ClientConfiguration>,
  'AwsClient' | 'awsClientOptions' | 'awsClientCapture' |
  'fetchData' | 'disablePrefetch' | 'cacheKey' | 'cacheExpiry' | 'setToContext'> {
}

declare function serviceDiscovery (options?: Options): middy.MiddlewareObj

export default serviceDiscovery
