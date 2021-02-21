import middy from '@middy/core'
import SQS from 'aws-sdk/clients/sqs.js'
import {captuteAWSClient} from 'aws-xray-sdk'

interface ISQSPartialBatchFailureOptions {
  AwsClient?: SQS,
  awsClientOptions?: Partial<SQS.Types.ClientConfiguration>;
  awsClientAssumeRole?: string,
  awsClientCapture?: captuteAWSClient,
  disablePrefetch?: boolean,
}

declare const sqsPartialBatchFailure: middy.Middleware<ISQSPartialBatchFailureOptions, any, any>

export default sqsPartialBatchFailure
