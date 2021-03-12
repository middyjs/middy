import { SSM } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options<S = SSM> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<SSM.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare function ssm (options?: Options): middy.MiddlewareObj

export default ssm
