import { STS } from 'aws-sdk'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = STS>
  extends Pick<MiddyOptions<S, STS.Types.ClientConfiguration>,
  'AwsClient' | 'awsClientOptions' | 'awsClientCapture' |
  'fetchData' | 'disablePrefetch' | 'cacheKey' | 'cacheExpiry' | 'setToContext'> {
}

declare function sts (options?: Options): middy.MiddlewareObj

export default sts
