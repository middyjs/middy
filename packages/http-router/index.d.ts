import middy from '@middy/core'
import {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  Handler as LambdaHandler
} from 'aws-lambda'

export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'ANY'

export interface Route<TEvent> {
  method: Method
  path: string
  handler: LambdaHandler<TEvent, APIGatewayProxyResult>
}

declare function httpRouterHandler<
  TEvent extends
  | ALBEvent
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2 = APIGatewayProxyEvent
> (routes: Array<Route<TEvent>>): middy.MiddyfiedHandler

export default httpRouterHandler
