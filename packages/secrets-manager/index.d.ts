import { SecretsManager } from 'aws-sdk'
import middy from '@middy/core'

interface ISecretsManagerOptions {
  cache?: boolean;
  cacheExpiryInMillis?: number;
  secrets?: { [key: string]: string; };
  awsSdkOptions?: Partial<SecretsManager.Types.ClientConfiguration>;
  throwOnFailedCall?: boolean;
  setEnvironment?: boolean
}

declare const secretsManager : middy.Middleware<ISecretsManagerOptions, any, any>

export default secretsManager
