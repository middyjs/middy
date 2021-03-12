import middy from '@middy/core'
import { SQS } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'

interface Options<S = SQS> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<SQS.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  disablePrefetch?: boolean
}

declare function sqsPartialBatchFailure (options?: Options): middy.MiddlewareObj

export default sqsPartialBatchFailure
