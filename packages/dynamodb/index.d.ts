import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { DynamoDBClient, DynamoDBClientConfig, GetItemCommandInput } from '@aws-sdk/client-dynamodb'
import { NativeAttributeValue } from '@aws-sdk/util-dynamodb'

export type ParamType<T extends Record<string, NativeAttributeValue>> = GetItemCommandInput & { __returnType?: T }
export declare function dynamoDbReq<T extends Record<string, NativeAttributeValue>> (req: GetItemCommandInput): ParamType<T>

export type DynamoDbOptions<AwsDynamoDBClient = DynamoDBClient> =
  Omit<MiddyOptions<AwsDynamoDBClient, DynamoDBClientConfig>, 'fetchData'>
  &
  {
    fetchData?: {
      [key: string]: GetItemCommandInput | ParamType<Record<string, NativeAttributeValue>>
    }
  }

export type Context<TOptions extends DynamoDbOptions | undefined> = TOptions extends {
  setToContext: true
}
  ? TOptions extends { fetchData: infer TFetchData }
    ? LambdaContext & {
      [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
        ? T
        : NativeAttributeValue
    }
    : never
  : LambdaContext

export type Internal<TOptions extends DynamoDbOptions | undefined> =
TOptions extends DynamoDbOptions
  ? TOptions extends { fetchData: infer TFetchData }
    ? {
        [Key in keyof TFetchData]: TFetchData[Key] extends ParamType<infer T>
          ? T
          : NativeAttributeValue
      }
    : {}
  : {}

declare function dynamodbMiddleware<TOptions extends DynamoDbOptions | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>, Internal<TOptions>>

export default dynamodbMiddleware
