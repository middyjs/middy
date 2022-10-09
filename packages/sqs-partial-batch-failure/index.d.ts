import middy from '@middy/core'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = SQSClient>
  extends Pick<
  MiddyOptions<S, SQSClient.Types.ClientConfiguration>,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientAssumeRole'
  | 'awsClientCapture'
  | 'disablePrefetch'
  > {}

declare function sqsPartialBatchFailure (options?: Options): middy.MiddlewareObj

export default sqsPartialBatchFailure
