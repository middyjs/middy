import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  AppConfigClient,
  AppConfigClientConfig,
  GetConfigurationRequest
} from '@aws-sdk/client-appconfig'

export type Options<AwsAppConfigClient = AppConfigClient>
  = Omit<MiddyOptions<AwsAppConfigClient, AppConfigClientConfig>, 'fetchData'>
  & {
    fetchData?: {
      [configurationRequestKey: string]: GetConfigurationRequest
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
