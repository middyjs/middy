import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import STS from 'aws-sdk/clients/sts'

interface Options<S = STS>
  extends Pick<
    MiddyOptions<S, STS.Types.ClientConfiguration>,
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
          accessKeyId: STS.accessKeyIdType
          secretAccessKey: STS.accessKeySecretType
          sessionToken: STS.tokenType
        }
      >
  : LambdaContext

declare function sts(options?: Options): middy.MiddlewareObj

export default sts
