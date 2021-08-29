import { S3 } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

export interface Options<S = S3> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<S3.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  disablePrefetch?: boolean,
  /**
   * The directory where the file will be downloaded
   * Defaults to `/tmp`
   */
  directory?: string,
  /**
   * Whether or not to prefix the file with the bucket name
   * Defaults to true
   */
  prefixBucketName?: boolean
}

declare function s3DownloadRecordsMiddleware (options?: Options): middy.MiddlewareObj

export default s3DownloadRecordsMiddleware
