import { S3 } from 'aws-sdk'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = S3>
  extends Pick<MiddyOptions<S, S3.Types.ClientConfiguration>,
  'AwsClient' | 'awsClientOptions' | 'awsClientAssumeRole' | 'awsClientCapture' | 'disablePrefetch'> {
  bodyType?: 'stream' | 'promise'
}

declare function s3ObjectResponse (options?: Options): middy.MiddlewareObj

export default s3ObjectResponse
