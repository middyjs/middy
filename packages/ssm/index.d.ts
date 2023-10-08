import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { SSMClient, SSMClientConfig } from '@aws-sdk/client-ssm'

export type ParamType<T> = string & { __returnType?: T }
export declare function ssmParam<T> (path: string): ParamType<T>

export interface SSMOptions<AwsSSMClient = SSMClient>
  extends Omit<MiddyOptions<AwsSSMClient, SSMClientConfig>, 'fetchData'> {
  fetchData?: { [key: string]: string | ParamType<unknown> }
}

export type Context<TOptions extends SSMOptions | undefined> =
TOptions extends { setToContext: true }
  ? TOptions extends { fetchData: infer TFetchData }
    ? LambdaContext & {
      [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
        ? T
        : unknown
    }
    : never
  : LambdaContext

export type Internal<TOptions extends SSMOptions | undefined> =
TOptions extends SSMOptions
  ? TOptions extends { fetchData: infer TFetchData }
    ? {
        [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
          ? T
          : unknown
      }
    : {}
  : {}

declare function ssm<TOptions extends SSMOptions> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default ssm
