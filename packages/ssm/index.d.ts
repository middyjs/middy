import { SSM } from '@aws-sdk/client-ssm'
import middy from '@middy/core'

interface ISSMOptions {
  awsClientConstructor?: SSM,
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  awsClientAssumeRole?: string,
  fetchKeys?: { [key: string]: string; },
  cacheExpiry: number,
}

declare const ssm : middy.Middleware<ISSMOptions, any, any>

export default ssm
