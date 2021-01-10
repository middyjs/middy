import { RDS } from '@aws-sdk/client-rds'
import middy from '@middy/core'

interface IRDSSignerOptions {
  AwsClient?: RDS.Signer,
  awsSdkOptions?: Partial<RDS.Signer.Types.ClientConfiguration>;
  awsClientAssumeRole?: string,
  fetchData?: {
    [key: string]: {
      [key: string]: string;
    };
    },
  cacheExpiry: number,
}

declare const rdsSigner : middy.Middleware<IRDSSignerOptions, any, any>
export default rdsSigner
