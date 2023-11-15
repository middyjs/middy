import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  AppConfigDataClient,
  AppConfigDataClientConfig,
  StartConfigurationSessionRequest
} from '@aws-sdk/client-appconfigdata'

export type ParamType<T> = StartConfigurationSessionRequest & { __returnType?: T }
export declare function appConfigReq<T> (req: StartConfigurationSessionRequest): ParamType<T>

export interface AppConfigOptions<AwsAppConfigClient = AppConfigDataClient>
  extends Omit<MiddyOptions<AwsAppConfigClient, AppConfigDataClientConfig>, 'fetchData'> {
  fetchData?: { [key: string]: StartConfigurationSessionRequest | ParamType<unknown> }
}

export type Context<TOptions extends AppConfigOptions | undefined> =
TOptions extends { setToContext: true }
  ? TOptions extends { fetchData: infer TFetchData }
    ? LambdaContext & {
      [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
        ? T
        : unknown
    }
    : never
  : LambdaContext

export type Internal<TOptions extends AppConfigOptions | undefined> =
TOptions extends AppConfigOptions
  ? TOptions extends { fetchData: infer TFetchData }
    ? {
        [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
          ? T
          : unknown
      }
    : {}
  : {}

declare function appConfigMiddleware<TOptions extends AppConfigOptions> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default appConfigMiddleware
