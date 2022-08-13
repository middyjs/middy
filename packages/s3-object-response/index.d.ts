import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import S3 from 'aws-sdk/clients/s3'
import { ClientRequest } from 'http'

interface Options<S = S3>
  extends Pick<
  MiddyOptions<S, S3.Types.ClientConfiguration>,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientAssumeRole'
  | 'awsClientCapture'
  | 'disablePrefetch'
  > {
  bodyType?: 'stream' | 'promise'
}

export type Context<TOptions extends Options | undefined> = LambdaContext & {
  s3Object: TOptions extends { bodyType: 'stream' }
    ? ClientRequest
    : TOptions extends { bodyType: 'promise' }
      ? Promise<any>
      : never
}

declare function s3ObjectResponse<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default s3ObjectResponse
