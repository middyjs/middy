import middy from '@middy/core'
import {
  ALBEvent,
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
  Any = 'ANY'
}

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
