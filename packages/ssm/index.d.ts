import { SSM } from 'aws-sdk'
import middy from '@middy/core'

interface ISSMOptions {
  cache?: boolean;
  cacheExpiryInMillis?: number;
  paths?: { [key: string]: string; };
  names?: { [key: string]: string; };
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  setToContext?: boolean;
  paramsLoaded?: Boolean;
  getParamNameFromPath?: (path: string, name: string, prefix: string) => string;
}

declare const ssm : middy.Middleware<ISSMOptions, any, any>

export default ssm
