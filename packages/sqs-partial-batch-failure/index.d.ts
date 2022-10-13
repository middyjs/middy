import middy from '@middy/core'
import { SQSClient, SQSClientConfig } from '@aws-sdk/client-sqs'
import { Options as MiddyOptions } from '@middy/util'

interface Options<AwsSQSClient = SQSClient>
  extends Pick<
  MiddyOptions<AwsSQSClient, SQSClientConfig>,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientAssumeRole'
  | 'awsClientCapture'
  | 'disablePrefetch'
  > {}

declare function sqsPartialBatchFailure (options?: Options): middy.MiddlewareObj

export default sqsPartialBatchFailure
