import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { SecretsManagerClient, SecretsManagerClientConfig } from '@aws-sdk/client-secrets-manager'

interface Options<AwsSecretsManagerClient = SecretsManagerClient>
  extends MiddyOptions<
  AwsSecretsManagerClient,
  SecretsManagerClientConfig
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
