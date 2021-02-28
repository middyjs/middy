import SSM from 'aws-sdk/clients/ssm'
import { captuteAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface ISSMOptions {
  AwsClient?: SSM
  awsClientOptions?: Partial<SSM.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: captuteAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare const ssm: middy.Middleware<ISSMOptions, any, any>

export default ssm
