import { STS } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options<S = STS> {
  AwsClient?: new() => S
  awsClientOptions?: Partial<STS.Types.ClientConfiguration>
  // awsClientAssumeRole?: string,
  awsClientCapture?: typeof captureAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  // setToEnv?: boolean,
  setToContext?: boolean
}

declare function sts (options?: Options): middy.MiddlewareObj

export default sts
