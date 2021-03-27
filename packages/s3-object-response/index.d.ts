import { S3 } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options<S = S3> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<S3.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  disablePrefetch?: boolean
  bodyType?: string
}

declare function s3ObjectResponse (options?: Options): middy.MiddlewareObj

export default s3ObjectResponse
