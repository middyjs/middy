import middy from '@middy/core'
import { Context as LambdaContext } from 'aws-lambda'

export type ParamType<T> = string & { __returnType?: T }
export declare function parametersSecretsLambdaExtensionParam<T> (
  path: string
): ParamType<T>

export interface parametersSecretsLambdaExtensionOptions {
  type: string // systemsmanager, secretsmanager
  fetchData?: { [key: string]: string | ParamType<unknown> }
}

export type Context<
  TOptions extends parametersSecretsLambdaExtensionOptions | undefined
> = TOptions extends { setToContext: true }
  ? TOptions extends { fetchData: infer TFetchData }
    ? LambdaContext & {
      [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
        ? T
        : unknown
    }
    : never
  : LambdaContext

export type Internal<
  TOptions extends parametersSecretsLambdaExtensionOptions | undefined
> = TOptions extends parametersSecretsLambdaExtensionOptions
  ? TOptions extends { fetchData: infer TFetchData }
    ? {
        [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
          ? T
          : unknown
      }
    : {}
  : {}

declare function parametersSecretsLambdaExtension<
  TOptions extends parametersSecretsLambdaExtensionOptions
> (
  options?: TOptions
): middy.MiddlewareObj<
unknown,
any,
Error,
Context<TOptions>,
Internal<TOptions>
>

export default parametersSecretsLambdaExtension
