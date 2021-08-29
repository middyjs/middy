import { S3 } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

export interface Options<S = S3> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<S3.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  disablePrefetch?: boolean,
  directory?: string = '/tmp',
  prefixBucketName?: boolean = true
}

declare function s3DownloadRecordsMiddleware (options?: Options): middy.MiddlewareObj

export default s3DownloadRecordsMiddleware
