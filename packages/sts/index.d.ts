import STS from 'aws-sdk/clients/sts'
import { captuteAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface ISTSOptions {
  AwsClient?: STS
  awsClientOptions?: Partial<STS.Types.ClientConfiguration>
  // awsClientAssumeRole?: string,
  awsClientCapture?: captuteAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  // setToEnv?: boolean,
  setToContext?: boolean
}

declare const ssm: middy.Middleware<ISTSOptions, any, any>

export default ssm
