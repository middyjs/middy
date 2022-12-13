/*
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'

interface Options<AwsDynamoDBClient = DynamoDBClient>
  extends MiddyOptions<AwsDynamoDBClient, DynamoDBClientConfig> {}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function dynamodb<TOptions extends Options | undefined>(
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default dynamodb
*/
