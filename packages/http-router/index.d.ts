import middy from '@middy/core'
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler as LambdaHandler
} from 'aws-lambda'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'ANY'

export interface Route {
  method: Method
  path: string
  handler: LambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
}

declare function httpRouterHandler (routes: Route[]): middy.MiddyfiedHandler

export default httpRouterHandler
