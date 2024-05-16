import middy, { MiddyfiedHandler } from '@middy/core'
import {
  ALBEvent,
  ALBResult,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Handler as LambdaHandler
} from 'aws-lambda'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'ANY'

export interface Route<TEvent, TResult> {
  method: Method
  path: string
  handler: LambdaHandler<TEvent, TResult> | MiddyfiedHandler<TEvent, TResult, any, any>
}

declare function httpRouterHandler<
  TEvent extends
  | ALBEvent
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2 = APIGatewayProxyEvent,
  TResult extends
  | ALBResult
  | APIGatewayProxyResult
  | APIGatewayProxyResultV2 = APIGatewayProxyResult
> (routes: Array<Route<TEvent, TResult>>): middy.MiddyfiedHandler<TEvent, TResult>

export default httpRouterHandler
