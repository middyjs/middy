import { RDS } from '@aws-sdk/client-rds'
import middy from '@middy/core'

interface IRDSSignerOptions {
  awsClientConstructor?: RDS,
  awsSdkOptions?: Partial<RDS.Types.ClientConfiguration>;
  awsClientAssumeRole?: string,
  fetchKeys?: {
    [key: string]: {
      [key: string]: string;
    };
    },
  cacheExpiry: number,
}

declare const rdsSigner : middy.Middleware<IRDSSignerOptions, any, any>
export default rdsSigner
