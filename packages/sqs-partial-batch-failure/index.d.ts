import middy from '@middy/core'
import { SQS } from 'aws-sdk'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = SQS> extends Pick<MiddyOptions<S, SQS.Types.ClientConfiguration>,
'AwsClient' | 'awsClientOptions' | 'awsClientAssumeRole' | 'awsClientCapture' | 'disablePrefetch'> {
}

declare function sqsPartialBatchFailure (options?: Options): middy.MiddlewareObj

export default sqsPartialBatchFailure
