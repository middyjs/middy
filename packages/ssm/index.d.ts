import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import SSM from 'aws-sdk/clients/ssm'
import { JsonValue } from 'type-fest'

interface Options<S = SSM>
  extends MiddyOptions<S, SSM.Types.ClientConfiguration> {}

type Basename<T> = T extends `${infer _P}/${infer _S}` ? Basename<_S> : T
type ExtractPaths<T> = T extends `${infer _P}/${infer _S}` ? T : never
type ExtractSingles<T> = T extends `${infer _P}/${infer _S}` ? never : T

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext &
      Record<Basename<ExtractPaths<keyof TOptions['fetchData']>>, JsonValue> &
      Record<ExtractSingles<keyof TOptions['fetchData']>, JsonValue>
  : LambdaContext

declare function ssm<TOptions extends Options>(
  options?: TOptions
): middy.MiddlewareObj<unknown, any, any, Context<TOptions>>

export default ssm
