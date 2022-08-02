import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import SecretsManager from 'aws-sdk/clients/secretsmanager'

interface Options<SM = SecretsManager>
  extends MiddyOptions<SM, SecretsManager.Types.ClientConfiguration> {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function secretsManager<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, any, Context<TOptions>>

export default secretsManager
