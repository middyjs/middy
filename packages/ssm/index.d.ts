import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import SSM from 'aws-sdk/clients/ssm'
import { JsonValue } from 'type-fest'

interface Options<S = SSM>
  extends MiddyOptions<S, SSM.Types.ClientConfiguration> {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Basename<T> = T extends `${infer _P}/${infer _S}` ? Basename<_S> : T
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractPaths<T> = T extends `${infer _P}/${infer _S}` ? T : never
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSingles<T> = T extends `${infer _P}/${infer _S}` ? never : T

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext &
  Record<Basename<ExtractPaths<keyof TOptions['fetchData']>>, JsonValue> &
  Record<ExtractSingles<keyof TOptions['fetchData']>, JsonValue>
  : LambdaContext

declare function ssm<TOptions extends Options> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default ssm
