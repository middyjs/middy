import middy, { MiddyfiedHandler } from '@middy/core'
import {
  ALBEvent,
  ALBResult,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  Handler as LambdaHandler
} from 'aws-lambda'

export enum Method {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Patch = 'PATCH',
  Delete = 'DELETE',
  Options = 'OPTIONS',
  Head = 'HEAD',
  Any = 'ANY'
}

type TResult = ALBResult | APIGatewayProxyResult

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
