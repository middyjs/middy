import { SSM, STS } from 'aws-sdk'
import middy from '@middy/core'

interface ISSMOptions {
  onChange?: () => void;
  cache?: boolean;
  cacheExpiryInMillis?: number;
  paths?: { [key: string]: string; };
  names?: { [key: string]: string; };
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  setToContext?: boolean;
  paramsLoaded?: Boolean;
  getParamNameFromPath?: (path: string, name: string, prefix: string) => string;
  stsOptions?: ISTSOptions
}

interface ISTSOptions {
  assumeRoleOptions: Partial<STS.Types.AssumeRoleRequest>;
  awsSdkOptions?: Partial<STS.Types.ClientConfiguration>
}

declare const ssm : middy.Middleware<ISSMOptions, any, any>

export default ssm
