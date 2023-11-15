import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { SignerConfig, Signer } from '@aws-sdk/rds-signer'

export type RdsSignerOptions<AwsSigner = Signer> = Omit<MiddyOptions<AwsSigner, SignerConfig>, 'fetchData'> & {
  fetchData?: {
    [key: string]: SignerConfig
  }
}

export type Context<TOptions extends RdsSignerOptions | undefined> =
TOptions extends { setToContext: true }
  ? TOptions extends { fetchData: infer TFetchData }
    ? LambdaContext & {
      [Key in keyof TFetchData]: string
    }
    : LambdaContext
  : LambdaContext

export type Internal<TOptions extends RdsSignerOptions | undefined> =
TOptions extends RdsSignerOptions
  ? TOptions extends { fetchData: infer TFetchData }
    ? {
        [Key in keyof TFetchData]: string
      }
    : {}
  : {}

declare function rdsSigner<TOptions extends RdsSignerOptions | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default rdsSigner
