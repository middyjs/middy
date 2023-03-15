import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  AppConfigDataClient,
  AppConfigDataClientConfig,
  StartConfigurationSessionRequest
} from '@aws-sdk/client-appconfigdata'


export type Options<AwsAppConfigClient = AppConfigDataClient>
  = Omit<MiddyOptions<AwsAppConfigClient, AppConfigDataClientConfig>, 'fetchData'>
  & {
    fetchData?: {
      [configurationRequestKey: string]: StartConfigurationSessionRequest
    }
  }

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function appConfigMiddleware<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default appConfigMiddleware
