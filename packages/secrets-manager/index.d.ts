import { SecretsManager } from 'aws-sdk'
import middy from '../core'

interface ISecretsManagerOptions {
  cache?: boolean;
  cacheExpiryInMillis?: number;
  secrets?: { [key: string]: string; };
  awsSdkOptions?: Partial<SecretsManager.Types.ClientConfiguration>;
}

declare function secretsManager(opts?: ISecretsManagerOptions): middy.IMiddyMiddlewareObject;
