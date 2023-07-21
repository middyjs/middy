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

type TResult = ALBResult | APIGatewayProxyResult | APIGatewayProxyResultV2

export interface Route<TEvent> {
  method: Method
  path: string
  handler: LambdaHandler<TEvent, TResult> | MiddyfiedHandler<TEvent, TResult, any, any>
}

declare function httpRouterHandler<
  TEvent extends
  | ALBEvent
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2 = APIGatewayProxyEvent
> (routes: Array<Route<TEvent>>): middy.MiddyfiedHandler

export default httpRouterHandler
