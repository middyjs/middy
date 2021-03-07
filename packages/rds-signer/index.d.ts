import { RDS } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options<Signer = RDS.Signer> {
  AwsClient?: new() => Signer
  awsClientOptions?: Partial<RDS.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare function rdsSigner (options?: Options): middy.MiddlewareObj

export default rdsSigner
