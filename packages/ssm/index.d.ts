import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { SSMClient, SSMClientConfig } from '@aws-sdk/client-ssm'
import { JsonValue } from 'type-fest'

interface Options<AwsSSMClient = SSMClient>
  extends MiddyOptions<AwsSSMClient, SSMClientConfig> {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSingles<T> = T extends `/${infer _}` ? never : T

export type Internal<TOptions extends Options> = Record<ExtractSingles<keyof TOptions['fetchData']>, JsonValue>

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext &
  Record<ExtractSingles<keyof TOptions['fetchData']>, JsonValue> &
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (keyof TOptions['fetchData'] extends `${infer _P}/${infer _S}`
    ? Record<string, JsonValue>
    : unknown)
  : LambdaContext

declare function ssm<TOptions extends Options> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default ssm
