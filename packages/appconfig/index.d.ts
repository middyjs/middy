/*
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import {
  AppConfigClient,
  AppConfigClientConfig
} from '@aws-sdk/client-appconfig'

interface Options<AwsAppConfigClient = AppConfigClient>
  extends MiddyOptions<AwsAppConfigClient, AppConfigClientConfig> {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function appConfig<TOptions extends Options | undefined>(
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default appConfig
*/
