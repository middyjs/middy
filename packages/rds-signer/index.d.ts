import RDS from 'aws-sdk/clients/rds'
import { captuteAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface IRDSSignerOptions {
  AwsClient?: RDS.Signer
  awsClientOptions?: Partial<RDS.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: captuteAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare const rdsSigner: middy.Middleware<IRDSSignerOptions, any, any>

export default rdsSigner
