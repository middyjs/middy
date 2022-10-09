import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { STSClient } from '@aws-sdk/client-sts'

interface Options<S = STSClient>
  extends Pick<
    MiddyOptions<S, STSClient.Types.ClientConfiguration>,
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
          accessKeyId: STSClient.accessKeyIdType
          secretAccessKey: STSClient.accessKeySecretType
          sessionToken: STSClient.tokenType
        }
      >
  : LambdaContext

declare function sts<TOptions extends Options>(
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default sts
