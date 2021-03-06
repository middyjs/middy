import { Signer, Types } from 'aws-sdk/clients/rds'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options {
  AwsClient?: Signer
  awsClientOptions?: Partial<Types.ClientConfiguration>
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
