import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { SecretsManagerClient } from '@aws-sdk/client-secretsmanager'

interface Options<AwsSecretsManagerClient = SecretsManagerClient>
  extends MiddyOptions<
  AwsSecretsManagerClient,
  SecretsManagerClient.Types.ClientConfiguration
  > {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function secretsManager<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default secretsManager
