import { SecretsManager } from 'aws-sdk'
import { captureAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface Options {
  AwsClient?: typeof SecretsManager
  awsClientOptions?: Partial<SecretsManager.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: typeof captureAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare function secretsManager (options?: Options): middy.MiddlewareObj

export default secretsManager
