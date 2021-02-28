import SecretsManager from 'aws-sdk/clients/secrets-manager'
import { captuteAWSClient } from 'aws-xray-sdk'
import middy from '@middy/core'

interface ISecretsManagerOptions {
  AwsClient?: SecretsManager
  awsClientOptions?: Partial<SecretsManager.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: captuteAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare const secretsManager: middy.Middleware<ISecretsManagerOptions, any, any>

export default secretsManager
