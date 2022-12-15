import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'
import { Context as LambdaContext } from 'aws-lambda'
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'

type Options<AwsDynamoDBClient = DynamoDBClient> = Omit<MiddyOptions<AwsDynamoDBClient, DynamoDBClientConfig>, 'fetchData'>
&
{
  fetchData: {
    // TODO: add more precise type
    [key: string]: Record<string, any>
  }
}

export type Context<TOptions extends Options | undefined> = TOptions extends {
  setToContext: true
}
  ? LambdaContext & Record<keyof TOptions['fetchData'], any>
  : LambdaContext

declare function dynamodbMiddleware<TOptions extends Options | undefined> (
  options?: TOptions
): middy.MiddlewareObj<unknown, any, Error, Context<TOptions>>

export default dynamodbMiddleware
