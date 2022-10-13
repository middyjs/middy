import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { STSClient, STSClientConfig } from '@aws-sdk/client-sts'

interface Options<AwsSTSClient = STSClient>
  extends Pick<
  MiddyOptions<AwsSTSClient, STSClientConfig>,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientCapture'
  | 'fetchData'
  | 'disablePrefetch'
  | 'cacheKey'
  | 'cacheExpiry'
  | 'setToContext'
  > {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext &
  Record<
  keyof TOptions['fetchData'],
  {
    credentials: STSClientConfig['credentials']
  }
  >
  : LambdaContext

declare function sts<TOptions extends Options> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default sts
